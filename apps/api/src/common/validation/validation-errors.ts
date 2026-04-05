import type { ValidationError } from 'class-validator';

type ApiValidationError = {
  field: string;
  code: string;
  message: string;
};

export function flattenValidationErrors(
  validationErrors: ValidationError[],
  parentPath = ''
): ApiValidationError[] {
  const formattedErrors: ApiValidationError[] = [];

  for (const validationError of validationErrors) {
    const fieldPath = parentPath
      ? `${parentPath}.${validationError.property}`
      : validationError.property;

    if (validationError.constraints) {
      for (const [code, message] of Object.entries(validationError.constraints)) {
        formattedErrors.push({
          field: fieldPath,
          code,
          message
        });
      }
    }

    if (validationError.children?.length) {
      formattedErrors.push(...flattenValidationErrors(validationError.children, fieldPath));
    }
  }

  return formattedErrors;
}
