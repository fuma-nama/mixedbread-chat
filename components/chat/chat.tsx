"use client";

import { useChat } from "@ai-sdk/react";
import { generateId } from "ai";
import { cn } from "cn";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { mutate } from "swr";
import { setChatLeaf } from "@/app/(chat)/actions";
import { useChats, useChatTitle } from "@/components/sidebar/chats-provider";
import { useReducedMotion } from "@/hooks/use-media";
import { childrenOf, latestLeaf, pathTo } from "@/lib/branches";
import { citationsAlong, searchedStores } from "@/lib/messages";
import type { ChatMessage } from "@/lib/search-tool";
import type { SearchScope } from "@/lib/sources";
import { type CachedChat, chatKey } from "./chat-cache";
import { ChatHeader } from "./chat-header";
import { Composer, type ComposerHandle } from "./composer";
import { Conversation } from "./conversation";
import { EmptyState, Suggestions } from "./empty-state";
import { preloadMarkdown } from "./lazy-markdown";
import { type Appear, MessageView } from "./message";
import { useModels } from "./models-provider";
import {
  ErrorNotice,
  type Failure,
  failureOf,
  failureOfStatus,
  SharedNotice,
  Unanswered,
} from "./notices";
import { ShareDialog } from "./share-dialog";
import { useSearchScope, useSelection } from "./sources-provider";

const placeholders: Record<SearchScope, string> = {
  web: "Ask anything",
  docs: "Ask about your stores",
  both: "Ask your stores or the web",
  none: "Ask anything",
};

// Holds the answer's place until it shows, so the real one takes over the view.
const PENDING: ChatMessage = { id: "pending", role: "assistant", parts: [] };

/** The server turned a message away. */
class Refusal extends Error {
  constructor(readonly status: number) {
    super(`The server refused the message (${status}).`);
  }
}

/** A chat as saved, and the answer it runs as it streams. */
export function Chat({ id, saved }: { id: string; saved: CachedChat }) {
  const chats = useChats();
  const selection = useSelection();
  const scope = useSearchScope();
  // Someone else's shared chat.
  const readonly = !saved.owner;
  const title = useChatTitle(id) ?? (saved.title || undefined);
  const { models, model, setModel, reasoning, setReasoning } = useModels();
  // The server turned a message away, or never got it.
  const [refusal, setRefusal] = useState<Failure>();
  // Messages there when the chat opened hold still; later ones rise in.
  const [opened] = useState(
    () => new Set(saved.messages.map((message) => message.id)),
  );
  // Versions brought back by a switch fade in.
  const [faded, setFaded] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [leaving, setLeaving] = useState<React.CSSProperties | null>(null);
  const [turn, setTurn] = useState<{ id: string; key: number }>();
  const composer = useRef<ComposerHandle>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const glideFrom = useRef<DOMRect | null>(null);
  // Following failed, so the next try waits a moment.
  const failed = useRef(false);
  // Sends go one at a time, so the server keeps their order.
  const sending = useRef<Promise<unknown>>(Promise.resolve());
  const reduced = useReducedMotion();
  const current = models.find((entry) => entry.id === model);
  // A model that doesn't take the effort picked for another thinks on Auto.
  const effort =
    reasoning !== "auto" && current?.efforts.includes(reasoning)
      ? reasoning
      : "auto";

  /** Changes the chat as kept, ahead of the server. */
  const change = (update: (chat: CachedChat) => Partial<CachedChat>) =>
    void mutate(
      chatKey(id),
      (cached?: CachedChat | null) => {
        const chat = cached ?? saved;
        return { ...chat, ...update(chat) };
      },
      { revalidate: false },
    );

  // Only the answer being followed; the rest is the chat as saved.
  const {
    messages: live,
    setMessages: setLive,
    status,
    resumeStream,
    stop,
  } = useChat<ChatMessage>({
    id,
    throttle: 40,
    onFinish({ message, isAbort, isDisconnect, isError }) {
      if (isAbort || isDisconnect || isError) return;
      setAnnouncement(
        endOf(message) === "stopped" ? "Stopped." : "Answer ready.",
      );
      chats.refresh();
    },
    onError(error) {
      failed.current = true;
      if (failureOf(error) === "session") setRefusal("session");
    },
  });

  const running = live.at(-1);
  const shown = useMemo(() => {
    const path: ChatMessage[] = pathTo(
      saved.messages,
      saved.leafId ?? saved.messages.at(-1)?.id ?? null,
    );
    if (!running) return path;
    // The answer that streams shows in place of its saved, empty copy.
    const at = path.findIndex((message) => message.id === running.id);
    return at === -1 ? [...path, running] : path.with(at, running);
  }, [saved, running]);
  const last = shown.at(-1);
  const answering = running !== undefined;
  const busy = answering || saved.running;
  // The server has the chat to answer, and shows no answer yet.
  const waiting = !answering && saved.running && last?.role === "user";
  const empty = shown.length === 0;
  const idle = !readonly && !busy;
  const rendered = waiting ? [...shown, PENDING] : shown;
  const writing = answering ? running : PENDING;
  const citations = citationsAlong(rendered);
  const children = childrenOf(saved.messages);
  // The last answer failed, or what ran it went before it wrote anything.
  const broken =
    idle &&
    last?.role === "assistant" &&
    (endOf(last) === "failed" || last.parts.length === 0);
  const failure = refusal ?? (broken ? "other" : undefined);
  const retryLabel = current && `Try again with ${current.name}`;
  // Screen readers hear where a search is, not every token of it.
  const spoken = (answering && searchStatus(running)) || announcement;
  const stores = searchedStores(shown);

  // The first message glides the composer from the middle to its dock.
  useLayoutEffect(() => {
    const from = glideFrom.current;
    glideFrom.current = null;
    const element = composer.current?.element();
    if (empty || !from || !element) return;
    const distance = from.top - element.getBoundingClientRect().top;
    if (Math.abs(distance) < 2) return;
    element.animate([{ translate: `0 ${distance}px` }, { translate: "0 0" }], {
      duration: 460,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }, [empty]);

  // As an answer starts, the chat as saved has its question and empty copy.
  useEffect(() => {
    if (status === "streaming") void mutate(chatKey(id));
  }, [id, status]);

  // Showing the chat busy, the tab hears at once if nothing runs it anymore.
  const asking = useEffectEvent(() =>
    saved.running ? { headers: { "x-busy": "1" } } : undefined,
  );
  // The tab follows each answer the chat runs, whichever of the owner's
  // devices asked, and catches up on the chat after each.
  const follow = useEffectEvent(async (following: AbortSignal) => {
    let behind = false;
    while (!following.aborted) {
      if (document.hidden) {
        await new Promise((resolve) =>
          document.addEventListener("visibilitychange", resolve, {
            once: true,
            signal: following,
          }),
        );
        behind = true;
      }
      // The network or server may still be down.
      if (failed.current) {
        failed.current = false;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (following.aborted) return;
      }
      if (behind) {
        await mutate(chatKey(id));
        if (following.aborted) return;
        setLive([]);
      }
      await resumeStream(asking());
      behind = true;
    }
  });
  // Hidden, the tab stops waiting for an answer, but follows one to its end.
  const hide = useEffectEvent(() => {
    if (document.hidden && status !== "streaming" && status !== "submitted") {
      void stop();
    }
  });
  useEffect(() => {
    if (readonly) return;
    const following = new AbortController();
    void follow(following.signal);
    document.addEventListener("visibilitychange", hide, {
      signal: following.signal,
    });
    return () => following.abort();
  }, [id, readonly]);

  function answer(questionId: string) {
    setTurn((turn) => ({ id: questionId, key: (turn?.key ?? 0) + 1 }));
    setAnnouncement("");
  }

  function dismiss() {
    setRefusal(undefined);
  }

  /**
   * Saves `message` after `parentId`, or after what the chat shows last, for
   * the chat's runner to answer. It shows at once, and goes if refused.
   */
  function post(
    message: ChatMessage,
    parentId?: string | null,
    undo?: () => void,
  ) {
    dismiss();
    // The view pins a question as its answer comes in.
    if (!busy) answer(message.id);
    preloadMarkdown();
    const sent = sending.current.then(async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          id,
          message,
          parentId,
          model,
          reasoning: effort,
          sources: selection,
        }),
      });
      if (!response.ok) throw new Refusal(response.status);
    });
    sending.current = sent.catch(() => {});
    void mutate<CachedChat | null, void>(chatKey(id), sent, {
      // On what shows, which has the sends still on their way.
      optimisticData: (current, displayed) => {
        const chat = displayed ?? current ?? saved;
        const known = chat.messages.some((entry) => entry.id === message.id);
        // Where the server puts it: after `parentId`, or the latest.
        const placed = {
          ...message,
          parentId: parentId === undefined ? chat.leafId : parentId,
        };
        return {
          ...chat,
          running: true,
          leafId: message.id,
          messages: known ? chat.messages : [...chat.messages, placed],
        };
      },
      // Lost on the way, it may have arrived: the chat as saved tells.
      rollbackOnError: (error) => error instanceof Refusal,
      populateCache: false,
      revalidate: true,
    }).catch((error: Error) => {
      const refused = error instanceof Refusal;
      setRefusal(failureOfStatus(refused ? error.status : 0));
      if (refused) undo?.();
    });
  }

  function focusComposer() {
    dismiss();
    composer.current?.focus();
  }

  function switchTo(messageId: string) {
    const leaf = latestLeaf(children, messageId);
    const showing = new Set(shown.map((message) => message.id));
    const brought: string[] = [];
    for (const message of pathTo(saved.messages, leaf)) {
      if (!showing.has(message.id)) brought.push(message.id);
    }
    dismiss();
    setFaded((faded) => {
      const next = new Set(faded);
      for (const entry of brought) next.add(entry);
      return next;
    });
    change(() => ({ leafId: leaf }));
    void setChatLeaf(id, leaf);
    const versions =
      children.get(
        saved.messages.find((message) => message.id === messageId)?.parentId ??
          null,
      ) ?? [];
    const index = versions.findIndex((version) => version.id === messageId);
    setAnnouncement(`Showing version ${index + 1} of ${versions.length}.`);
  }

  function switchVersion(messageId: string, step: -1 | 1) {
    const index = shown.findIndex((message) => message.id === messageId);
    const siblings = children.get(shown[index - 1]?.id ?? null) ?? [];
    const known = siblings.findIndex((sibling) => sibling.id === messageId);
    const target = siblings[(known === -1 ? siblings.length : known) + step];
    if (target) switchTo(target.id);
  }

  /** Answers the last question again, after the message it follows. */
  function answerAgain() {
    const index = shown.findLastIndex((message) => message.role === "user");
    const question = shown[index];
    if (question) post(question, shown[index - 1]?.id ?? null);
  }

  function send(text: string) {
    if (empty) {
      const hero = heroRef.current?.getBoundingClientRect();
      const frame = frameRef.current?.getBoundingClientRect();
      if (!reduced && hero && frame) {
        glideFrom.current =
          composer.current?.element()?.getBoundingClientRect() ?? null;
        setLeaving({
          top: hero.top - frame.top,
          left: hero.left - frame.left,
          width: hero.width,
        });
      }
      window.history.replaceState(null, "", `/c/${id}`);
      chats.update(id, {
        title: text.split("\n")[0].slice(0, 80),
        updatedAt: new Date(),
      });
    }
    post(userMessage(text), undefined, () => {
      composer.current?.restore(text);
      if (!empty) return;
      window.history.replaceState(null, "", "/");
      chats.remove(new Set([id]));
    });
  }

  function edit(messageId: string, text: string) {
    const index = shown.findIndex((message) => message.id === messageId);
    post(userMessage(text), shown[index - 1]?.id ?? null, () =>
      composer.current?.restore(text),
    );
    composer.current?.focus();
  }

  function retry(messageId: string) {
    const index = shown.findIndex((message) => message.id === messageId);
    const question = shown[index - 1];
    if (question) post(question, shown[index - 2]?.id ?? null);
    composer.current?.focus();
  }

  function appearOf(message: ChatMessage): Appear {
    if (message === PENDING || !opened.has(message.id)) return "rise";
    return faded.has(message.id) ? "fade" : undefined;
  }

  return (
    <div ref={frameRef} className="relative flex min-h-0 flex-1 flex-col">
      <title>{title ? `${title} · Bread Chat` : "Bread Chat"}</title>
      <ChatHeader
        title={empty ? undefined : title}
        share={
          !readonly &&
          !empty && (
            <ShareDialog
              chatId={id}
              initialVisibility={saved.visibility}
              onChange={(visibility) => change(() => ({ visibility }))}
              stores={stores}
            />
          )
        }
      />

      {!empty && (
        <Conversation turn={turn} streaming={busy}>
          {rendered.map((message, index) => {
            const parentId = rendered[index - 1]?.id ?? null;
            // A message sent this visit is the newest of its versions.
            const siblings = children.get(parentId) ?? [];
            const known = siblings.findIndex(
              (sibling) => sibling.id === message.id,
            );
            const last = index === rendered.length - 1;
            return (
              <MessageView
                // Keyed by parent, so switching versions keeps the view in place.
                key={parentId ?? "root"}
                message={message}
                citations={citations[index]}
                appear={appearOf(message)}
                live={message === writing}
                stopped={endOf(message) === "stopped"}
                version={known === -1 ? siblings.length : known}
                versions={known === -1 ? siblings.length + 1 : siblings.length}
                pinned={last && message.role === "assistant"}
                retryLabel={retryLabel}
                onEdit={idle ? edit : undefined}
                onRetry={idle ? retry : undefined}
                onSwitch={idle ? switchVersion : undefined}
              />
            );
          })}
          {failure && (
            <ErrorNotice
              failure={failure}
              onRetry={refusal ? focusComposer : answerAgain}
            />
          )}
          {idle && !failure && rendered.at(-1)?.role === "user" && (
            <Unanswered onAnswer={answerAgain} />
          )}
        </Conversation>
      )}

      {(empty || leaving) && (
        <div
          className={
            leaving
              ? "pointer-events-none absolute z-10 motion-safe:animate-[fade_200ms_ease-out_reverse_both]"
              : "flex flex-1 flex-col justify-center pb-6 md:justify-end md:pb-9"
          }
          style={leaving ?? undefined}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setLeaving(null);
          }}
        >
          <EmptyState ref={heroRef} />
        </div>
      )}

      <div
        className={cn(
          "mx-auto flex w-full max-w-[44rem] flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6",
          empty ? "max-md:order-2 md:pb-3" : "md:pb-5",
        )}
      >
        {readonly ? (
          <SharedNotice />
        ) : (
          <>
            {failure && empty && (
              <ErrorNotice failure={failure} onRetry={focusComposer} />
            )}
            <Composer
              ref={composer}
              status={busy ? "streaming" : "ready"}
              model={model}
              onModelChange={setModel}
              reasoning={effort}
              efforts={current?.efforts}
              onReasoningChange={setReasoning}
              onSubmit={send}
              // After the sends before it, so it reaches what they started.
              onStop={() =>
                void sending.current.then(() =>
                  fetch(`/api/chat/${id}/stream`, { method: "DELETE" }),
                )
              }
              placeholder={empty ? placeholders[scope] : "Ask a follow-up"}
              blocked={
                current?.toast && scope === "none"
                  ? "Pick a source for Toast to answer from"
                  : undefined
              }
              fresh={empty}
            />
          </>
        )}
      </div>

      {empty && !readonly && (
        <div className="max-md:order-1 max-md:pb-3 md:flex-[1.2] md:pt-2">
          <Suggestions scope={scope} onPick={send} />
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </div>
  );
}

/** How an answer ended short of done, as kept. */
function endOf(message: ChatMessage | undefined) {
  return message?.parts.findLast((part) => part.type === "data-ended")?.data;
}

function userMessage(text: string): ChatMessage {
  return { id: generateId(), role: "user", parts: [{ type: "text", text }] };
}

function searchStatus(message: ChatMessage | undefined): string | undefined {
  const part = message?.parts.findLast((part) => part.type === "tool-search");
  if (!part) return undefined;
  if (part.state !== "output-available" || part.output.status !== "done") {
    return "Searching.";
  }
  const count = part.output.sources.length;
  if (count === 0) return "Searched, no sources cited.";
  return `Found ${count} ${count === 1 ? "source" : "sources"}.`;
}
