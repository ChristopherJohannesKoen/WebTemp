import { getE2EEnv } from './e2e-env';

type FailpointPayload = {
  body?: Record<string, unknown>;
  delayMs?: number;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  statusCode: number;
  times?: number;
};

const apiOrigin = getE2EEnv().API_ORIGIN;

export async function clearFailpoints() {
  await fetch(`${apiOrigin}/api/__e2e/failpoints`, {
    method: 'DELETE'
  });
}

export async function setFailpoint(payload: FailpointPayload) {
  const response = await fetch(`${apiOrigin}/api/__e2e/failpoints`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to set failpoint: ${response.status}`);
  }
}
