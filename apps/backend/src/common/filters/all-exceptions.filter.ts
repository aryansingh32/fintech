import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standardized error envelope for every API response, and the single place
 * that decides what a client is allowed to see. Financial/internal error
 * detail (stack traces, DB errors, provider payloads) is logged server-side
 * only - never returned to the customer app. See blueprint #51.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = "We couldn't complete your request right now. Please try again.";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        details = b.errors ?? undefined;
        code = (b.code as string) ?? this.codeForStatus(status);
      }
      if (status >= 500) {
        // A 5xx HttpException (e.g. ServiceUnavailableException for an
        // unconfigured provider) still needs to reach the logs - only the
        // client-facing message gets masked below, not the server record.
        this.logger.error(
          `5xx HttpException on ${request.method} ${request.url}: ${message}`,
        );
        message = "We couldn't complete your request right now. Please try again.";
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details: status < 500 ? details : undefined,
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'ERROR';
    }
  }
}
