/** Keeps `value` in a cookie for a year, for the server to read on the next visit. */
export function remember(name: string, value: string) {
  void cookieStore.set({
    name,
    value,
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });
}
