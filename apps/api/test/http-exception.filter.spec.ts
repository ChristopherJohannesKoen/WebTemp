import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

function createHost() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  const request = {
    originalUrl: '/api/test',
    requestId: 'request_1'
  };

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as never,
    response
  };
}

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits auth_required for authentication failures', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new UnauthorizedException('Authentication required.'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'auth_required',
        statusCode: 401
      })
    );
  });

  it('emits csrf_invalid for CSRF validation failures', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new ForbiddenException('A valid CSRF token is required.'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'csrf_invalid',
        statusCode: 403
      })
    );
  });

  it('emits invalid_origin for origin guard failures', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new ForbiddenException('Invalid request origin.'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid_origin',
        statusCode: 403
      })
    );
  });

  it('emits forbidden for generic authorization failures', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new ForbiddenException('You do not have access to this resource.'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'forbidden',
        statusCode: 403
      })
    );
  });

  it('emits not_found for missing resources', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new NotFoundException('Project not found.'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'not_found',
        statusCode: 404
      })
    );
  });

  it('preserves explicit export_limit_exceeded codes', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        message: 'Filtered export exceeds the synchronous export limit.',
        code: 'export_limit_exceeded',
        errors: [
          {
            field: 'request',
            code: 'export_limit_exceeded',
            message: 'Filtered export exceeds the synchronous export limit.'
          }
        ]
      }),
      host
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'export_limit_exceeded',
        statusCode: 400
      })
    );
  });

  it('emits upstream_error for unhandled exceptions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new Error('boom'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'upstream_error',
        statusCode: 500
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
