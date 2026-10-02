"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { cn } from "cn";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { mutate } from "swr";
import { setChatLeaf } from "@/app/(chat)/actions";
import { useReducedMotion } from "@/hooks/use-media";
import { childrenOf, latestLeaf, pathTo } from "@/lib/branches";
import { citationsAlong, searchedStores } from "@/lib/messages";
import type { ChatMessage } from "@/lib/search-tool";
import {
  type CachedChat,
  changeChats,
  chatKey,
  refreshChats,
  useChatList,
} from "./chat-cache";
import { ChatHeader } from "./chat-header";
import { Composer, type ComposerHandle } from "./composer";
import { Conversation } from "./conversation";
import { EmptyState, Suggestions } from "./empty-state";
import { type Appear, endOf, MessageView, preloadMarkdown } from "./message";
import {
  ErrorNotice,
  type Failure,
  failureOf,
  failureOfStatus,
  SharedNotice,
  Unanswered,
} from "./notices";
import { useModel, useSearchScope, useSelection } from "./picks";
import { ShareDialog } from "./share-dialog";

// Holds the answer's place until it shows, so the real one takes over the view.
const PENDING: ChatMessage = { id: "pending", role: "assistant", parts: [] };

/** Reads the answer a send started from its response, and any other from the stream route. */
class Transport extends DefaultChatTransport<ChatMessage> {
  async reconnectToStream(
    options: Parameters<
      DefaultChatTransport<ChatMessage>["reconnectToStream"]
    >[0],
  ) {
    const sent = await (
      options.metadata as Promise<Response> | undefined
    )?.catch(() => undefined);
    if (sent?.status === 201 && sent.body) {
      return this.processResponseStream(sent.body);
    }
    const stream = await super.reconnectToStream(options);
    // Another tab's answer: the chat as saved has its question by now.
    if (stream) void mutate(chatKey(options.chatId));
    return stream;
  }
}

const transport = new Transport();

class Refusal extends Error {
  constructor(readonly status: number) {
    super(`The server refused the message (${status}).`);
  }
}

export function Chat({ id, saved }: { id: string; saved: CachedChat }) {
  const selection = useSelection();
  const scope = useSearchScope();
  const readonly = !saved.owner;
  const title =
    useChatList().find((chat) => chat.id === id)?.title ??
    (saved.title || undefined);
  const { model, effort } = useModel();
  const [refusal, setRefusal] = useState<Failure>();
  const [opened] = useState(
    () => new Set(saved.messages.map((message) => message.id)),
  );
  const [faded, setFaded] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [leaving, setLeaving] = useState<React.CSSProperties | null>(null);
  const [turn, setTurn] = useState<{ id: string }>();
  const composer = useRef<ComposerHandle>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const glideFrom = useRef<DOMRect | null>(null);
  const failed = useRef(false);
  // Sends go one at a time, so the server keeps their order.
  const sending = useRef<Promise<unknown>>(Promise.resolve());
  // A send whose response may carry the answer it starts, unread yet.
  const started = useRef<Promise<Response>>(undefined);
  const reduced = useReducedMotion();

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
    transport,
    onFinish({ message, isAbort, isDisconnect, isError }) {
      if (isAbort || isDisconnect || isError) return;
      setAnnouncement(
        endOf(message) === "stopped" ? "Stopped." : "Answer ready.",
      );
      refreshChats();
    },
    onError(error) {
      failed.current = true;
      if (failureOf(error) === "session") setRefusal("session");
    },
  });

  const running = live.at(-1);
  const shown: ChatMessage[] = pathTo(saved.messages, saved.leafId);
  // The streaming answer replaces its saved, empty copy.
  if (running) {
    const at = shown.findIndex((message) => message.id === running.id);
    shown[at === -1 ? shown.length : at] = running;
  }
  const last = shown.at(-1);
  const answering = running !== undefined;
  const busy = answering || saved.running;
  const waiting = !answering && saved.running && last?.role === "user";
  const empty = shown.length === 0;
  const idle = !readonly && !busy;
  const rendered = waiting ? [...shown, PENDING] : shown;
  const writing = answering ? running : PENDING;
  const citations = citationsAlong(rendered);
  const children = childrenOf(saved.messages);
  // An empty answer means what ran it went down before writing.
  const broken =
    idle &&
    last?.role === "assistant" &&
    (endOf(last) === "failed" || last.parts.length === 0);
  const failure = refusal ?? (broken ? "other" : undefined);
  // Screen readers hear where a search is, not every token of it.
  const spoken = (answering && searchStatus(running)) || announcement;
  const stores = searchedStores(shown);

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

  // With `x-busy`, the server answers at once if nothing runs the chat anymore.
  const asking = useEffectEvent(() => {
    const sent = started.current;
    started.current = undefined;
    return {
      metadata: sent,
      headers: saved.running ? { "x-busy": "1" } : undefined,
    };
  });
  // Follows each answer the chat runs, whichever device asked, catching up after each.
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
    return () => {
      following.abort();
      void started.current?.then((response) => response.body?.cancel());
    };
  }, [id, readonly]);

  function answer(questionId: string) {
    setTurn({ id: questionId });
    setAnnouncement("");
  }

  function dismiss() {
    setRefusal(undefined);
  }

  function post(
    message: ChatMessage,
    parentId?: string | null,
    undo?: () => void,
  ) {
    dismiss();
    // The view pins a question as its answer comes in.
    if (!busy) answer(message.id);
    preloadMarkdown();
    const sent = sending.current.then(() =>
      fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          id,
          message,
          parentId,
          model,
          reasoning: effort,
          sources: selection,
        }),
      }),
    );
    sending.current = sent.catch(() => {});
    if (!started.current) started.current = sent;
    // A follow that only waits ends, so the tab reads the answer at once.
    if (status !== "streaming" && status !== "submitted") void stop();
    const saving = sent.then((response) => {
      if (!response.ok) throw new Refusal(response.status);
    });
    void mutate<CachedChat | null, void>(chatKey(id), saving, {
      // `displayed` has the sends still on their way.
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
      // The tab catches up as the answer ends.
      populateCache: false,
      revalidate: false,
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

  function switchVersion(messageId: string, step: -1 | 1) {
    const index = shown.findIndex((message) => message.id === messageId);
    const parentId = shown[index - 1]?.id ?? null;
    const { siblings, version } = versionOf(children, parentId, messageId);
    const target = siblings[version + step];
    if (!target) return;
    const leaf = latestLeaf(children, target.id);
    const showing = new Set(shown.map((message) => message.id));
    const brought = new Set(faded);
    for (const message of pathTo(saved.messages, leaf)) {
      if (!showing.has(message.id)) brought.add(message.id);
    }
    dismiss();
    setFaded(brought);
    change(() => ({ leafId: leaf }));
    void setChatLeaf(id, leaf);
    setAnnouncement(
      `Showing version ${version + step + 1} of ${siblings.length}.`,
    );
  }

  function reask(index: number) {
    const question = shown[index];
    if (question) post(question, shown[index - 1]?.id ?? null);
  }

  function answerAgain() {
    reask(shown.findLastIndex((message) => message.role === "user"));
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
      changeChats((chats) => [
        { id, title: text.split("\n")[0].slice(0, 80), updatedAt: new Date() },
        ...chats,
      ]);
    }
    post(userMessage(text), undefined, () => {
      composer.current?.restore(text);
      if (!empty) return;
      window.history.replaceState(null, "", "/");
      changeChats((chats) => chats.filter((chat) => chat.id !== id));
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
    reask(shown.findIndex((message) => message.id === messageId) - 1);
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
              visibility={saved.visibility}
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
            const { siblings, version } = versionOf(
              children,
              parentId,
              message.id,
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
                version={version}
                versions={Math.max(siblings.length, version + 1)}
                pinned={last && message.role === "assistant"}
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
              busy={busy}
              onSubmit={send}
              // After the sends before it, so it reaches what they started.
              onStop={() =>
                void sending.current.then(() =>
                  fetch(`/api/chat/${id}/stream`, { method: "DELETE" }),
                )
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

/** Versions count oldest first; one sent this visit is the newest. */
function versionOf(
  children: Map<string | null, { id: string }[]>,
  parentId: string | null,
  messageId: string,
) {
  const siblings = children.get(parentId) ?? [];
  const known = siblings.findIndex((sibling) => sibling.id === messageId);
  return { siblings, version: known === -1 ? siblings.length : known };
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
