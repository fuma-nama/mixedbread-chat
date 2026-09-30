/**
 * Where to go after signing in: a path on this site, never another origin.
 * It is resolved the way a browser would, which drops tabs and newlines and
 * reads backslashes as slashes, so no spelling of another origin gets past.
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

/** `path`, carrying `next` along when it goes somewhere other than home. */
export function withNext(path: string, next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
