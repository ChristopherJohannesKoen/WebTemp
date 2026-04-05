import { ApiErrorSchema } from '@packages/shared';
import type { ZodType } from 'zod';

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string;
  code?: string;
  requestId?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
};

export type ApiResponseType = 'json' | 'text' | 'empty' | 'blob';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors: Array<{ field: string; code: string; message: string }> = [],
    public readonly requestId?: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

export class ApiContractError extends ApiRequestError {
  constructor(message: string, statusCode: number, requestId?: string) {
    super(message, statusCode, [], requestId, 'invalid_api_response');
  }
}

export function toApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  return new ApiRequestError('Something went wrong.', 500);
}

function isJsonContentType(contentType: string) {
  return contentType.toLowerCase().includes('json');
}

function getRequestId(response: Response) {
  return response.headers.get('x-request-id') ?? undefined;
}

function createContractError(response: Response, message: string) {
  return new ApiContractError(message, response.status || 502, getRequestId(response));
}

async function parseJsonBody(response: Response) {
  try {
    const body = await response.text();

    if (!body.trim()) {
      throw new Error('empty_body');
    }

    return JSON.parse(body);
  } catch {
    throw createContractError(response, 'The API returned malformed JSON.');
  }
}

async function throwApiResponseError(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type') ?? '';

  if (isJsonContentType(contentType)) {
    const payload = await parseJsonBody(response);
    const parsedError = ApiErrorSchema.safeParse(payload);

    if (!parsedError.success) {
      throw createContractError(response, 'The API returned an unexpected error payload.');
    }

    throw new ApiRequestError(
      parsedError.data.message,
      parsedError.data.statusCode ?? response.status,
      parsedError.data.errors,
      parsedError.data.requestId ?? getRequestId(response),
      parsedError.data.code
    );
  }

  const message = (await response.text()).trim() || 'Request failed.';
  throw new ApiRequestError(message, response.status, [], getRequestId(response));
}

export async function parseJsonResponse<T>(response: Response, schema?: ZodType<T>) {
  const contentType = response.headers.get('content-type') ?? '';

  if (!isJsonContentType(contentType)) {
    throw createContractError(response, 'Expected a JSON response from the API.');
  }

  const payload = await parseJsonBody(response);

  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(payload);

    if (!parsedError.success) {
      throw createContractError(response, 'The API returned an unexpected error payload.');
    }

    throw new ApiRequestError(
      parsedError.data.message,
      parsedError.data.statusCode ?? response.status,
      parsedError.data.errors,
      parsedError.data.requestId ?? getRequestId(response),
      parsedError.data.code
    );
  }

  if (!schema) {
    return payload as T;
  }

  const parsedPayload = schema.safeParse(payload);

  if (!parsedPayload.success) {
    throw createContractError(response, 'The API returned data that did not match the expected contract.');
  }

  return parsedPayload.data;
}

export async function parseTextResponse(response: Response) {
  if (!response.ok) {
    return throwApiResponseError(response);
  }

  return response.text();
}

export async function parseEmptyResponse(response: Response) {
  if (!response.ok) {
    return throwApiResponseError(response);
  }

  const body = await response.text();

  if (body.trim().length > 0) {
    throw createContractError(response, 'Expected an empty response from the API.');
  }

  return undefined;
}

export async function parseBlobResponse(response: Response) {
  if (!response.ok) {
    return throwApiResponseError(response);
  }

  return response.blob();
}

export async function parseExpectedResponse<T>(
  response: Response,
  options?: {
    responseType?: ApiResponseType;
    schema?: ZodType<T>;
  }
) {
  switch (options?.responseType ?? 'json') {
    case 'text':
      return parseTextResponse(response) as Promise<T>;
    case 'empty':
      return parseEmptyResponse(response) as Promise<T>;
    case 'blob':
      return parseBlobResponse(response) as Promise<T>;
    case 'json':
    default:
      return parseJsonResponse(response, options?.schema);
  }
}
