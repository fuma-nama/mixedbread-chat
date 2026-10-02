/** For the server to read on later visits, including ones from another site's link. */
export function remember(name: string, value: string) {
  void cookieStore.set({
    name,
    value,
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });
}
