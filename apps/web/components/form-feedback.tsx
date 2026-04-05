'use client';

import { useEffect, useRef } from 'react';

export function FormErrorMessage({
  error,
  regionTestId,
  messageTestId
}: {
  error?: string;
  regionTestId: string;
  messageTestId: string;
}) {
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  return (
    <div
      aria-live="polite"
      className="min-h-6"
      data-testid={regionTestId}
      ref={error ? errorRef : undefined}
      role="status"
      tabIndex={error ? -1 : undefined}
    >
      {error ? (
        <p className="text-sm text-rose-600" data-testid={messageTestId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FieldErrorMessage({
  error,
  id,
  testId
}: {
  error?: string;
  id: string;
  testId?: string;
}) {
  if (!error) {
    return null;
  }

  return (
    <p className="text-xs text-rose-600" data-testid={testId} id={id}>
      {error}
    </p>
  );
}
