import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@packages/shared';
import type { AuthenticatedRequest } from '../types/authenticated-request';

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

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as {
        message?: string | string[];
        error?: string;
        errors?: ApiError['errors'];
      };

      if (responseObject.errors) {
        message = typeof responseObject.message === 'string' ? responseObject.message : 'Validation failed';
        errors = responseObject.errors;
      } else if (Array.isArray(responseObject.message)) {
        message = 'Validation failed';
        errors = responseObject.message.map((entry) => ({
          field: 'request',
          code: 'invalid',
          message: entry
        }));
      } else if (responseObject.message) {
        message = responseObject.message;
      } else if (responseObject.error) {
        message = responseObject.error;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      errors,
      requestId: request.requestId
    });
  }
}
