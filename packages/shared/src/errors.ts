export class MorrowlaneError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MorrowlaneError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class NotFoundError extends MorrowlaneError {
  constructor(what: string) {
    super('not_found', `${what} was not found.`, 404);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends MorrowlaneError {
  constructor(message = 'You do not have access to this resource.') {
    super('forbidden', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends MorrowlaneError {
  constructor(message = 'Sign in to continue.') {
    super('unauthorized', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends MorrowlaneError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('validation_failed', message, 422, details);
    this.name = 'ValidationError';
  }
}

export function toHttpError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof MorrowlaneError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  return {
    status: 500,
    code: 'internal_error',
    message: error instanceof Error ? error.message : 'Something went wrong.',
  };
}
