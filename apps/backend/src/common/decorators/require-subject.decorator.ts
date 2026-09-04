import { SetMetadata } from '@nestjs/common';
import { SubjectType } from '@prisma/client';

export const SUBJECT_TYPE_KEY = 'subjectType';
/** Restricts an endpoint to one identity domain (STAFF-only or CUSTOMER-only). */
export const RequireSubject = (subject: SubjectType) => SetMetadata(SUBJECT_TYPE_KEY, subject);
