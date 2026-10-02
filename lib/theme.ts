export const themes = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;

export type Theme = (typeof themes)[number]["id"];

export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme.id === value);
}

/** For the browser's own bars around the page. */
export const themeColors = { light: "#fefcf9", dark: "#18120f" };
