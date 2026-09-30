"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { cn } from "cn";
import { useLayoutEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { setChatLeaf } from "@/app/(chat)/actions";
import { useChats, useChatTitle } from "@/components/sidebar/chats-provider";
import { useReducedMotion } from "@/hooks/use-media";
import { childrenOf, latestLeaf, pathTo, withPath } from "@/lib/branches";
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
  failureOf,
  SharedNotice,
  Unanswered,
  wasRejected,
} from "./notices";
import { ShareDialog } from "./share-dialog";
import { useSearchScope, useSources } from "./sources-provider";

const placeholders: Record<SearchScope, string> = {
  web: "Ask anything",
  docs: "Ask about your stores",
  both: "Ask your stores or the web",
  none: "Ask anything",
};

// Holds the answer's place while waiting, so the real one takes over the view.
const PENDING: ChatMessage = { id: "pending", role: "assistant", parts: [] };

/** A chat, from how it was saved or last left. */
export function Chat({ id, saved }: { id: string; saved: CachedChat }) {
  const chats = useChats();
  const sources = useSources();
  const scope = useSearchScope();
  // Someone else's shared chat.
  const readonly = !saved.owner;
  const title = useChatTitle(id) ?? (saved.title || undefined);
  const [tree, setTree] = useState(saved.messages);
  const { models, model, setModel, reasoning, setReasoning } = useModels();
  // SWR keeps the chat as shown, so switching back to it is instant.
  const keep = (change: Partial<CachedChat>) =>
    void mutate(
      chatKey(id),
      (cached?: CachedChat | null) => ({ ...(cached ?? saved), ...change }),
      { revalidate: false },
    );
  const [stopped, setStopped] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [initial] = useState(() => {
    const path = pathTo(
      saved.messages,
      saved.leafId ?? saved.messages.at(-1)?.id ?? null,
    );
    return {
      path,
      shown: new Set(path.map((message) => message.id)),
      known: new Set(saved.messages.map((message) => message.id)),
    };
  });
  const composer = useRef<ComposerHandle>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const glideFrom = useRef<DOMRect | null>(null);
  // The server turned the last request away before saving it.
  const refused = useRef(false);
  const [leaving, setLeaving] = useState<React.CSSProperties | null>(null);
  const [turn, setTurn] = useState<{ id: string; key: number }>();
  const reduced = useReducedMotion();
  const current = models.find((entry) => entry.id === model);
  // A model that doesn't take the effort picked for another thinks on Auto.
  const effort =
    reasoning !== "auto" && current?.efforts.includes(reasoning)
      ? reasoning
      : "auto";

  const transport = new DefaultChatTransport<ChatMessage>({
    body: () => ({
      model,
      reasoning: effort,
      sources: sources.selection.get(),
    }),
    // New messages and retries both end with the user message to answer.
    prepareSendMessagesRequest: ({ id, messages, body }) => ({
      body: {
        ...body,
        id,
        message: messages.at(-1),
        parentId: messages.at(-2)?.id ?? null,
      },
    }),
  });

  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
    status,
    stop,
    error,
    clearError,
  } = useChat<ChatMessage>({
    id,
    messages: initial.path,
    transport,
    throttle: 40,
    onData(part) {
      if (part.type === "data-title") chats.update(id, { title: part.data });
    },
    // Also when leaving mid-answer stops it, so the chat reopens as it was left.
    onFinish({ message, messages: path, isAbort }) {
      // `request` takes a refused one back.
      if (refused.current) return;
      keep({
        messages: withPath(tree, path),
        leafId: path.at(-1)?.id ?? null,
      });
      if (isAbort) {
        setStopped((stopped) => new Set(stopped).add(message.id));
        setAnnouncement("Stopped.");
      } else {
        setAnnouncement("Answer ready.");
      }
      chats.refresh();
    },
    onError(error) {
      refused.current = wasRejected(error);
    },
  });

  const empty = messages.length === 0;
  const busy = status === "submitted" || status === "streaming";
  const idle = !readonly && !busy;
  const rendered =
    busy && messages.at(-1)?.role === "user"
      ? [...messages, PENDING]
      : messages;
  const citations = citationsAlong(rendered);
  const children = childrenOf(tree);
  const failure = error ? failureOf(error) : undefined;
  const retryLabel = current && `Try again with ${current.name}`;
  // Screen readers hear where a search is, not every token of it.
  const spoken = (busy && searchStatus(messages.at(-1))) || announcement;
  const stores = searchedStores(messages);

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

  function answer(questionId: string) {
    setTurn((turn) => ({ id: questionId, key: (turn?.key ?? 0) + 1 }));
    setAnnouncement("");
  }

  // The id is made here, so the view can pin the question as it appears.
  function ask(text: string) {
    const question = generateId();
    answer(question);
    preloadMarkdown();
    return sendMessage({
      id: question,
      role: "user",
      parts: [{ type: "text", text }],
    });
  }

  /** Runs a request; `undo` takes it back if the server turns it away unsaved. */
  async function request(run: () => Promise<void>, undo?: () => void) {
    refused.current = false;
    await run();
    if (refused.current) undo?.();
  }

  function switchTo(messageId: string) {
    const all = withPath(tree, messages);
    const replies = childrenOf(all);
    const leaf = latestLeaf(replies, messageId);
    setTree(all);
    clearError();
    setMessages(pathTo(all, leaf));
    void setChatLeaf(id, leaf);
    keep({ messages: all, leafId: leaf });
    const versions =
      replies.get(
        all.find((message) => message.id === messageId)?.parentId ?? null,
      ) ?? [];
    const index = versions.findIndex((version) => version.id === messageId);
    setAnnouncement(`Showing version ${index + 1} of ${versions.length}.`);
  }

  function switchVersion(messageId: string, step: -1 | 1) {
    const index = messages.findIndex((message) => message.id === messageId);
    const siblings = children.get(messages[index - 1]?.id ?? null) ?? [];
    const known = siblings.findIndex((sibling) => sibling.id === messageId);
    const target = siblings[(known === -1 ? siblings.length : known) + step];
    if (target) switchTo(target.id);
  }

  function answerAgain() {
    const question = messages.findLast((message) => message.role === "user");
    if (question) answer(question.id);
    void request(regenerate);
  }

  function send(text: string) {
    clearError();
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
    void request(
      () => ask(text),
      () => {
        setMessages((messages) => messages.slice(0, -1));
        composer.current?.restore(text);
        if (!empty) return;
        window.history.replaceState(null, "", "/");
        chats.remove(new Set([id]));
      },
    );
  }

  function edit(messageId: string, text: string) {
    clearError();
    setTree(withPath(tree, messages));
    setMessages(
      messages.slice(
        0,
        messages.findIndex((message) => message.id === messageId),
      ),
    );
    void request(
      () => ask(text),
      () => {
        switchTo(messageId);
        composer.current?.restore(text);
      },
    );
    composer.current?.focus();
  }

  function retry(messageId: string) {
    clearError();
    setTree(withPath(tree, messages));
    const index = messages.findIndex((message) => message.id === messageId);
    const question = messages[index - 1];
    if (question) answer(question.id);
    void request(
      () => regenerate({ messageId }),
      () => switchTo(messageId),
    );
    composer.current?.focus();
  }

  // Messages there at load stay still; sent ones rise in, and versions
  // brought back from the saved tree fade in.
  function appearOf(messageId: string): Appear {
    if (initial.shown.has(messageId)) return undefined;
    return initial.known.has(messageId) ? "fade" : "rise";
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
              onChange={(visibility) => keep({ visibility })}
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
                appear={appearOf(message.id)}
                live={busy && last}
                stopped={stopped.has(message.id)}
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
          {failure && <ErrorNotice failure={failure} onRetry={answerAgain} />}
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
              <ErrorNotice
                failure={failure}
                onRetry={() => {
                  clearError();
                  composer.current?.focus();
                }}
              />
            )}
            <Composer
              ref={composer}
              status={status}
              model={model}
              onModelChange={setModel}
              reasoning={effort}
              efforts={current?.efforts}
              onReasoningChange={setReasoning}
              onSubmit={send}
              onStop={stop}
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
