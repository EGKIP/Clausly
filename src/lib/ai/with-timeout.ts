/**
 * Races a promise against a timeout. Note this only stops *waiting* on the
 * promise — it does not cancel whatever work is in flight (pdf-parse and
 * tesseract.js don't expose cancellation), so the original work may still
 * complete and resolve after the timeout has already rejected.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
