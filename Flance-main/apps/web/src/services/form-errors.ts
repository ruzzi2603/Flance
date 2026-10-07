type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | undefined {
  return typeof value === "object" && value !== null ? value as RecordValue : undefined;
}

export function getApiErrorDetails(error: unknown): {
  message?: string;
  fieldErrors: Record<string, string[]>;
} {
  const response = asRecord(asRecord(error)?.response);
  const data = asRecord(response?.data);
  const nestedError = asRecord(data?.error);
  const source = nestedError ?? data;
  const rawErrors = asRecord(source?.errors);
  const rawFieldErrors = asRecord(rawErrors?.fieldErrors);
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, value] of Object.entries(rawFieldErrors ?? {})) {
    if (Array.isArray(value)) {
      fieldErrors[field] = value.filter((item): item is string => typeof item === "string");
    } else if (typeof value === "string") {
      fieldErrors[field] = [value];
    }
  }

  const rawMessage = source?.message;
  const message = typeof rawMessage === "string"
    ? rawMessage
    : Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === "string").join(" ")
      : undefined;

  return { message, fieldErrors };
}
