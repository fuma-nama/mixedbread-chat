import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { HalftoneMark } from "@/components/brand/halftone-mark";
import { buttonVariants } from "@/components/ui/button";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16">
      <Link
        href="/"
        aria-label="Back to chat"
        className={buttonVariants({
          variant: "ghost",
          size: "icon-sm",
          className: "absolute top-4 left-4 text-muted-foreground",
        })}
      >
        <ArrowLeftIcon />
      </Link>
      <div className="flex w-full max-w-80 flex-col items-center text-center">
        {/* Stays put while you switch between logging in and signing up. */}
        <div className="h-20 w-36">
          <HalftoneMark />
        </div>
        {children}
      </div>
    </main>
  );
}
