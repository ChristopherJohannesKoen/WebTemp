import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errors: Array<{ field: string; message: string }> = [];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };

      if (Array.isArray(responseObject.message)) {
        message = 'Validation failed';
        errors = responseObject.message.map((entry) => ({
          field: 'request',
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
