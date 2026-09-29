import { cn } from "cn";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Mixedbread Chat", template: "%s · Mixedbread Chat" },
  description:
    "A chat app that searches your data and the web, powered by Mixedbread.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefcf9" },
    { media: "(prefers-color-scheme: dark)", color: "#18120f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
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
