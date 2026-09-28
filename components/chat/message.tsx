import { cn } from "cn";

export function Message({
  from,
  className,
  ...props
}: React.ComponentProps<"div"> & { from: "system" | "user" | "assistant" }) {
  return (
    <div
      data-role={from}
      className={cn(
        "group/message flex w-full flex-col gap-3",
        from === "user" && "items-end",
        className,
      )}
      {...props}
    />
  );
}

/** A user's message bubble; assistant text renders through `Markdown` instead. */
export function MessageBubble({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
