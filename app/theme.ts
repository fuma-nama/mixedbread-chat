import { cookies } from "next/headers";
import { isTheme, type Theme } from "@/lib/theme";

/** The theme picked last, remembered in a cookie by the theme menu. */
export async function selectedTheme(): Promise<Theme> {
  const theme = (await cookies()).get("theme")?.value;
  return isTheme(theme) ? theme : "system";
}
