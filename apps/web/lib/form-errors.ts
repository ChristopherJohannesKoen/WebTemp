type FieldError = {
  field: string;
  code: string;
  message: string;
};

export function toFieldErrorMap(errors: FieldError[]) {
  return errors.reduce<Record<string, string>>((accumulator, error) => {
    if (!error.field || error.field === 'request' || accumulator[error.field]) {
      return accumulator;
    }

    accumulator[error.field] = error.message;
    return accumulator;
  }, {});
}

export function describedByIds(...ids: Array<string | undefined | false>) {
  const value = ids.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}
