import { cn } from "cn";
import { SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Shortcut } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TypedText } from "@/components/ui/typed-text";

export function ChatHeader({
  title,
  share,
}: {
  title?: string;
  share?: React.ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 px-2 md:px-3">
      {/* The sidebar has these when it is open. */}
      <div className="flex items-center md:group-data-[sidebar=expanded]/shell:hidden">
        <SidebarTrigger />
        <NewChatButton className="max-md:hidden" />
      </div>
      <p className="min-w-0 truncate px-1.5 text-[13.5px] text-muted-foreground">
        {title && (
          <span className="motion-safe:animate-fade motion-safe:[animation-duration:400ms]">
            <TypedText text={title} />
          </span>
        )}
      </p>
      <div className="ml-auto flex items-center gap-0.5">
        {share && (
          <span className="flex motion-safe:animate-fade motion-safe:[animation-duration:400ms]">
            {share}
          </span>
        )}
        <NewChatButton className="md:hidden" />
      </div>
    </header>
  );
}

function NewChatButton({ className }: { className: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href="/"
            aria-label="New chat"
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className: cn("text-muted-foreground", className),
            })}
          />
        }
      >
        <SquarePenIcon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        New chat
        <Shortcut keys={["⇧", "O"]} />
      </TooltipContent>
    </Tooltip>
  );
}
