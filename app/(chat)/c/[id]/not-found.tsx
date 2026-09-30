import Link from "next/link";
import { SliceGlyph } from "@/components/brand/slice";
import { ChatHeader } from "@/components/chat/chat-header";
import { buttonVariants } from "@/components/ui/button";

export default function ChatNotFound() {
  return (
    <>
      <ChatHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-16 text-center">
        <SliceGlyph className="size-9 text-muted-foreground/35 motion-safe:animate-settle" />
        <h1 className="text-[1.375rem] leading-tight font-normal tracking-[-0.02em] motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
          This chat isn’t available
        </h1>
        <Link
          href="/"
          className={buttonVariants({
            className:
              "motion-safe:animate-rise motion-safe:[animation-delay:140ms]",
          })}
        >
          Start a chat
        </Link>
      </div>
    </>
  );
}
