"use client";

import { ShareIcon } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";

export function ShareDialog({
  chatId,
  initialVisibility,
  className,
}: {
  chatId: string;
  initialVisibility: "private" | "public";
  className?: string;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [copied, setCopied] = useState(false);

  async function update(next: "private" | "public") {
    await setChatVisibility(chatId, next);
    setVisibility(next);
  }

  return (
    <Dialog onOpenChange={() => setCopied(false)}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className={className} />}
      >
        <ShareIcon />
        Share
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share chat</DialogTitle>
          <DialogDescription>
            {visibility === "public"
              ? "Anyone with the link can read this chat."
              : "Create a link that lets anyone read this chat."}
          </DialogDescription>
        </DialogHeader>
        {visibility === "public" && <ShareLink chatId={chatId} />}
        <DialogFooter>
          {visibility === "public" ? (
            <>
              <Button variant="outline" onClick={() => void update("private")}>
                Stop sharing
              </Button>
              <Button
                onClick={() =>
                  void navigator.clipboard.writeText(shareUrl(chatId)).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  )
                }
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </>
          ) : (
            <Button onClick={() => void update("public")}>Create link</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rendered only while the dialog is open, so `window` exists. */
function ShareLink({ chatId }: { chatId: string }) {
  return (
    <Input
      aria-label="Link"
      value={shareUrl(chatId)}
      readOnly
      onFocus={(event) => event.currentTarget.select()}
    />
  );
}

function shareUrl(chatId: string) {
  return `${window.location.origin}/c/${chatId}`;
}
