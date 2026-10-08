type ErrorDetails = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
};

function isErrorDetails(value: unknown): value is ErrorDetails {
  return typeof value === "object" && value !== null;
}

/** Returns whether a database error represents a duplicate unique value. */
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;

  while (isErrorDetails(current) && !seen.has(current)) {
    seen.add(current);

    if (current.code === "23505" || current.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return true;
    }

    if (typeof current.message === "string" && current.message.includes("UNIQUE constraint failed")) {
      return true;
    }

    current = current.cause;
  }

  return false;
}
