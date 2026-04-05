export function readBooleanConfig(
  readValue: string | boolean | undefined | null,
  defaultValue = false
) {
  if (typeof readValue === 'boolean') {
    return readValue;
  }

  if (typeof readValue === 'string') {
    const normalizedValue = readValue.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off', ''].includes(normalizedValue)) {
      return false;
    }
  }

  return defaultValue;
}
