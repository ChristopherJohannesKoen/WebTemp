export type ApiErrorPayload = {
  statusCode?: number;
  message?: string;
  code?: string;
  requestId?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
};

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'message' in value || 'statusCode' in value || 'errors' in value;
}

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

export function toApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  return new ApiRequestError('Something went wrong.', 500);
}

export async function parseApiResponse<T>(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as T | ApiErrorPayload)
    : await response.text();

  if (!response.ok) {
    const errorPayload = isApiErrorPayload(payload) ? payload : {};
    throw new ApiRequestError(
      errorPayload.message ?? 'Request failed.',
      errorPayload.statusCode ?? response.status,
      errorPayload.errors ?? [],
      errorPayload.requestId,
      errorPayload.code
    );
  }

  return payload as T;
}
