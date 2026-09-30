"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MessageEditor({
  defaultValue,
  onCancel,
  onSubmit,
}: {
  defaultValue: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(defaultValue);

  function submit() {
    if (text.trim()) onSubmit(text.trim());
  }

  return (
    <div className="flex w-full max-w-[85%] flex-col gap-3 rounded-[20px] bg-card p-3 shadow-raised ring-1 ring-crust/40 motion-safe:animate-fade motion-safe:[animation-duration:150ms]">
      <textarea
        aria-label="Edit message"
        value={text}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by pressing Edit
        autoFocus
        onFocus={(event) => {
          const { length } = event.currentTarget.value;
          event.currentTarget.setSelectionRange(length, length);
        }}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
        className="field-sizing-content max-h-72 min-h-10 w-full resize-none scrollbar-thin bg-transparent px-1 text-base leading-relaxed outline-none md:text-[15px]"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button size="sm" disabled={!text.trim()} onClick={submit}>
          Send
        </Button>
      </div>
    </div>
  );
}
