import { ApiErrorSchema } from '@packages/shared';
import { ResponseValidationError, UnknownStatusError } from '@ts-rest/core';

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string;
  code?: string;
  requestId?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
};

type ContractErrorResponse = {
  status: number;
  body: unknown;
  headers?: Headers;
};

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

function getRequestId(headers?: Headers) {
  return headers?.get('x-request-id') ?? undefined;
}

function createContractError(message: string, statusCode = 502, requestId?: string) {
  return new ApiContractError(message, statusCode, requestId);
}

function toStructuredApiError(
  payload: ApiErrorPayload,
  responseStatus: number,
  requestId?: string
) {
  return new ApiRequestError(
    payload.message ?? 'Request failed.',
    payload.statusCode ?? responseStatus,
    payload.errors ?? [],
    payload.requestId ?? requestId,
    payload.code
  );
}

export function throwFromErrorResponse(response: ContractErrorResponse): never {
  const requestId = getRequestId(response.headers);
  const parsedError = ApiErrorSchema.safeParse(response.body);

  if (!parsedError.success) {
    throw createContractError(
      'The API returned an unexpected error payload.',
      response.status || 502,
      requestId
    );
  }

  throw toStructuredApiError(parsedError.data, response.status, requestId);
}

export function unwrapContractResponse<T>(
  response: ContractErrorResponse,
  expectedStatuses: readonly number[]
) {
  if (expectedStatuses.includes(response.status)) {
    return response.body as T;
  }

  return throwFromErrorResponse(response);
}

export function toApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof ResponseValidationError) {
    return createContractError('The API returned data that did not match the expected contract.');
  }

  if (error instanceof UnknownStatusError) {
    const parsedError = ApiErrorSchema.safeParse(error.response.body);

    if (parsedError.success) {
      return toStructuredApiError(parsedError.data, error.response.status);
    }

    return createContractError(
      'The API returned an unexpected response status.',
      error.response.status || 502
    );
  }

  return new ApiRequestError('Something went wrong.', 500);
}
