import Link from "next/link";
import { HalftoneMark } from "@/components/brand/halftone-mark";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 pb-16 text-center">
      <div className="h-20 w-36">
        <HalftoneMark />
      </div>
      <h1 className="mt-6 text-[1.75rem] leading-[1.15] font-normal tracking-[-0.025em] motion-safe:animate-rise motion-safe:[animation-delay:60ms]">
        Nothing baked here
      </h1>
      <Link
        href="/"
        className={buttonVariants({
          size: "lg",
          className:
            "mt-8 motion-safe:animate-rise motion-safe:[animation-delay:120ms]",
        })}
      >
        Start a chat
      </Link>
    </main>
  );
}
