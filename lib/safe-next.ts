/**
 * Where to go after signing in, on this site. Parsed as a browser would, so no
 * spelling of another origin gets past.
 */
export function safeNext(value: unknown): string {
  const url =
    typeof value === "string" && value.startsWith("/")
      ? URL.parse(value, "http://n")
      : null;
  return url?.origin === "http://n"
    ? url.pathname + url.search + url.hash
    : "/";
}

export function withNext(path: string, next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
