"use client";

import { CheckIcon, CopyIcon, GlobeIcon, ShareIcon } from "lucide-react";
import { memo, useState, useTransition } from "react";
import { setChatVisibility } from "@/app/(chat)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconSwap } from "@/components/ui/icon-swap";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { ChatMessage } from "@/lib/search-tool";

/** Whether a search in the chat found files in the user's stores. */
export function searchedStores(messages: ChatMessage[]): boolean {
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search" || part.state !== "output-available")
        continue;
      if (part.output.status !== "done") continue;
      for (const source of part.output.sources) {
        if (source.type === "file") return true;
      }
    }
  }
  return false;
}

export const ShareDialog = memo(function ShareDialog({
  chatId,
  initialVisibility,
  stores,
}: {
  chatId: string;
  initialVisibility: "private" | "public";
  /** Its searches found files in the user's stores, which a shared chat quotes. */
  stores: boolean;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const shared = visibility === "public";

  // Copies inside the click itself: Safari refuses clipboard writes after an await.
  function copy() {
    void navigator.clipboard.writeText(shareUrl(chatId)).then(
      () => {
        setCopied(true);
        toast.add({ title: "Link copied" });
      },
      () => setCopied(false),
    );
  }

  function change(next: "private" | "public") {
    startTransition(async () => {
      try {
        await setChatVisibility(chatId, next);
        setVisibility(next);
        if (next === "private") toast.add({ title: "Link turned off" });
      } catch {
        toast.add({ title: "Couldn’t update sharing. Try again." });
      }
    });
  }

  return (
    <Dialog onOpenChange={() => setCopied(false)}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground max-sm:size-8 max-sm:px-0"
          />
        }
      >
        {shared ? <GlobeIcon /> : <ShareIcon />}
        <span className="max-sm:sr-only">{shared ? "Shared" : "Share"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {shared ? "This chat is shared" : "Share chat"}
          </DialogTitle>
          <DialogDescription>
            {stores
              ? "Anyone with the link can read this chat, including the passages it quotes from your stores."
              : "Anyone with the link can read this chat."}
          </DialogDescription>
        </DialogHeader>

        {shared && (
          <div className="flex gap-2 motion-safe:animate-rise">
            <Input
              aria-label="Link"
              value={shareUrl(chatId)}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 font-mono text-[12.5px] text-muted-foreground"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={copied ? "Copied" : "Copy link"}
              onClick={copy}
            >
              <IconSwap
                swapped={copied}
                from={<CopyIcon />}
                to={<CheckIcon />}
              />
            </Button>
          </div>
        )}

        <DialogFooter>
          {shared ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => change("private")}
            >
              Stop sharing
            </Button>
          ) : (
            <Button
              disabled={pending}
              onClick={() => {
                copy();
                change("public");
              }}
            >
              Create and copy link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

function shareUrl(chatId: string) {
  return `${window.location.origin}/c/${chatId}`;
}
