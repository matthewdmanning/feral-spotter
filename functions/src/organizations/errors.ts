/** A permanent rejection the client must not retry unchanged. */
export class RequestError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 429 | 503,
    message: string,
  ) {
    super(message)
  }
  /** 409: the user must review and confirm again. */
  static confirmAgain(message: string): RequestError {
    return new RequestError(409, message)
  }
}

/** Storage and Auth SDK errors carry the HTTP status as `code`. */
export function errorCode(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code
}
