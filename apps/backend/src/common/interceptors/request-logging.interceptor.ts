import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * One log line per request: method, path, status, duration, and the
 * authenticated actor (once JwtAuthGuard has populated req.user). This is
 * the only place every API call is guaranteed to leave a trace, independent
 * of whether a handler/service logs anything itself - needed for production
 * debugging (blueprint: "add logging") without a separate APM/log pipeline.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, start),
        error: (err) => this.log(request, err?.status ?? 500, start),
      }),
    );
  }

  private log(request: Request, statusCode: number, start: number) {
    const durationMs = Date.now() - start;
    const user = (request as unknown as { user?: { id: string; subjectType: string } }).user;
    const actor = user ? `${user.subjectType}:${user.id}` : 'anonymous';
    this.logger.log(`${request.method} ${request.originalUrl} ${statusCode} ${durationMs}ms actor=${actor}`);
  }
}
