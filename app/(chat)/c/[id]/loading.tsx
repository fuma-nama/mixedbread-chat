import { ChatHeader } from "@/components/chat/chat-header";

/** A quiet stand-in while a chat loads: the shape of a turn, and the composer. */
export default function ChatLoading() {
  return (
    <>
      <ChatHeader />
      <div
        role="status"
        aria-label="Loading chat"
        className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col gap-3 px-4 pt-6 sm:px-6"
      >
        <div className="h-10 w-2/5 self-end rounded-[20px] bg-soft motion-safe:animate-pulse" />
        <div className="mt-8 h-3.5 w-11/12 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:150ms]" />
        <div className="h-3.5 w-4/5 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:300ms]" />
        <div className="h-3.5 w-3/5 rounded-full bg-soft motion-safe:animate-pulse motion-safe:[animation-delay:450ms]" />
      </div>
      <div className="mx-auto w-full max-w-[44rem] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 md:pb-5">
        <div className="h-[5.875rem] rounded-[22px] bg-card shadow-composer ring-1 ring-soft" />
      </div>
    </>
  );
}
