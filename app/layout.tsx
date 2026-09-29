import { cn } from "cn";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeColors } from "@/lib/theme";
import { selectedTheme } from "./theme";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Bread Chat", template: "%s · Bread Chat" },
  description:
    "A chat app that searches your data and the web, powered by Mixedbread.",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await selectedTheme();
  return {
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    // One color per device scheme; a picked theme sets both.
    themeColor: (["light", "dark"] as const).map((scheme) => ({
      media: `(prefers-color-scheme: ${scheme})`,
      color: themeColors[theme === "system" ? scheme : theme],
    })),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await selectedTheme();

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={cn(
        sans.variable,
        mono.variable,
        "scrollbar-thin scrollbar-thumb-border bg-background text-foreground antialiased [-webkit-tap-highlight-color:transparent] selection:bg-honey/40",
      )}
    >
      <body className="text-[15px]">
        <TooltipProvider delay={400} closeDelay={80}>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  );
}
