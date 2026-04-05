import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@packages/shared';
import type { AuthenticatedRequest } from '../types/authenticated-request';

function inferApiErrorCode(
  status: number,
  message: string,
  errors: ApiError['errors']
): string | undefined {
  const firstErrorCode = errors[0]?.code;

  if (firstErrorCode) {
    return firstErrorCode;
  }

  if (status === HttpStatus.BAD_REQUEST) {
    return 'invalid';
  }

  if (status === HttpStatus.UNAUTHORIZED) {
    return message === 'Authentication required.' ? 'auth_required' : 'unauthorized';
  }

  if (status === HttpStatus.FORBIDDEN) {
    if (message === 'A valid CSRF token is required.') {
      return 'csrf_invalid';
    }

    if (message === 'Missing request origin.' || message === 'Invalid request origin.') {
      return 'invalid_origin';
    }

    return 'forbidden';
  }

  if (status === HttpStatus.NOT_FOUND) {
    return 'not_found';
  }

  if (status === HttpStatus.CONFLICT) {
    return 'conflict';
  }

  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'upstream_error';
  }

  return undefined;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    if (!(exception instanceof HttpException)) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'http.unhandled_exception',
          requestId: request.requestId,
          path: request.originalUrl,
          error:
            exception instanceof Error
              ? {
                  name: exception.name,
                  message: exception.message,
                  stack: exception.stack
                }
              : String(exception)
        })
      );
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errors: ApiError['errors'] = [];
    let code: ApiError['code'];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as {
        message?: string | string[];
        error?: string;
        errors?: ApiError['errors'];
        code?: ApiError['code'];
      };

      if (responseObject.errors) {
        message =
          typeof responseObject.message === 'string' ? responseObject.message : 'Validation failed';
        errors = responseObject.errors;
        code = responseObject.code ?? responseObject.errors[0]?.code;
      } else if (Array.isArray(responseObject.message)) {
        message = 'Validation failed';
        errors = responseObject.message.map((entry) => ({
          field: 'request',
          code: 'invalid',
          message: entry
        }));
        code = responseObject.code ?? 'invalid';
      } else if (responseObject.message) {
        message = responseObject.message;
        code = responseObject.code;
      } else if (responseObject.error) {
        message = responseObject.error;
        code = responseObject.code;
      }
    }

    code ??= inferApiErrorCode(status, message, errors);

    response.status(status).json({
      statusCode: status,
      message,
      code,
      errors,
      requestId: request.requestId
    });
  }
}
