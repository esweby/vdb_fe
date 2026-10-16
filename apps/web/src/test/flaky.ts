/** Wraps an async function so its first call fails, like a dropped connection; later calls work. */
export function failsOnce<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  let calls = 0;
  return async (...args) => {
    if (calls++ === 0) throw new Error("Failed to fetch");
    return fn(...args);
  };
}
