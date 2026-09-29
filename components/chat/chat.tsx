"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { cn } from "cn";
import { CornerDownRightIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { setChatLeaf } from "@/app/(chat)/actions";
import { useChats, useChatTitle } from "@/components/sidebar/chats-provider";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-media";
import { useWindowEvent } from "@/hooks/use-window-event";
import { childrenOf, latestLeaf, pathTo, withPath } from "@/lib/branches";
import { citationsAlong } from "@/lib/messages";
import type { Reasoning } from "@/lib/reasoning";
import type { ChatMessage } from "@/lib/search-tool";
import type { SearchScope } from "@/lib/sources";
import { ChatHeader } from "./chat-header";
import { Composer, type ComposerHandle } from "./composer";
import { Conversation } from "./conversation";
import { EmptyState, Suggestions } from "./empty-state";
import { preloadMarkdown } from "./lazy-markdown";
import { type Appear, MessageView } from "./message";
import { useModels } from "./models-provider";
import { ErrorNotice, failureOf, SharedNotice, wasRejected } from "./notices";
import { ShareDialog, searchedStores } from "./share-dialog";
import { useSearchScope, useSources } from "./sources-provider";

/** A message with its place in the chat's branch tree. */
export type TreeMessage = ChatMessage & { parentId: string | null };

const placeholders: Record<SearchScope, string> = {
  web: "Ask anything",
  docs: "Ask about your stores",
  both: "Ask your stores or the web",
  none: "Ask anything",
};

const transport = new DefaultChatTransport<ChatMessage>({
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

// While waiting on a reply, a stand-in answer holds its place, so the real
// one takes over the same view instead of popping in.
const PENDING: ChatMessage = { id: "pending", role: "assistant", parts: [] };

export function Chat({
  id,
  initialMessages,
  initialLeafId,
  initialModel,
  initialReasoning,
  initialTitle,
  visibility,
  readonly = false,
}: {
  id: string;
  initialMessages: TreeMessage[];
  initialLeafId: string | null;
  initialModel: string;
  initialReasoning: Reasoning;
  initialTitle?: string;
  visibility: "private" | "public";
  /** Someone else's shared chat. */
  readonly?: boolean;
}) {
  const chats = useChats();
  const sources = useSources();
  const scope = useSearchScope();
  const title = useChatTitle(id) ?? initialTitle;
  const [tree, setTree] = useState(initialMessages);
  const [model, setModel] = useState(initialModel);
  const [reasoning, setReasoning] = useState(initialReasoning);
  const [stopped, setStopped] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [initial] = useState(() => {
    const path = pathTo(
      initialMessages,
      initialLeafId ?? initialMessages.at(-1)?.id ?? null,
    );
    const shown = new Set<string>();
    for (const message of path) shown.add(message.id);
    const known = new Set<string>();
    for (const message of initialMessages) known.add(message.id);
    return { path, shown, known };
  });
  const composer = useRef<ComposerHandle>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const glideFrom = useRef<DOMRect | null>(null);
  // The last request, so one the server turns away can be taken back.
  const lastSend = useRef<{
    text?: string;
    first: boolean;
    /** Show this message's branch again instead of dropping the last message. */
    restore?: string;
  }>(null);
  const [leaving, setLeaving] = useState<React.CSSProperties | null>(null);
  // The question being answered this visit, brought to the top of the view.
  const [turn, setTurn] = useState<{ id: string; key: number }>();
  const reduced = useReducedMotion();

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
    onFinish({ message, isAbort }) {
      if (isAbort) {
        setStopped((stopped) => new Set(stopped).add(message.id));
        setAnnouncement("Stopped.");
      } else {
        setAnnouncement("Answer ready.");
      }
      chats.refresh();
    },
    onError(error) {
      // The server turned the message away before saving it: take it back.
      const send = lastSend.current;
      if (!send || !wasRejected(error)) return;
      lastSend.current = null;
      if (send.restore) switchTo(send.restore);
      else setMessages((messages) => messages.slice(0, -1));
      if (send.text) composer.current?.restore(send.text);
      if (send.first) {
        window.history.replaceState(null, "", "/");
        chats.remove(new Set([id]));
      }
    },
  });

  const empty = messages.length === 0;
  const busy = status === "submitted" || status === "streaming";
  // Edits, retries and version switches wait for the answer, and are the owner's.
  const idle = !readonly && !busy;
  const rendered =
    busy && messages.at(-1)?.role === "user"
      ? [...messages, PENDING]
      : messages;
  const citations = citationsAlong(rendered);
  const children = useMemo(() => childrenOf(tree), [tree]);
  const failure = error ? failureOf(error) : undefined;
  const current = useModels().find((entry) => entry.id === model);
  // A model that doesn't take the effort picked for another thinks on Auto.
  const effort =
    reasoning !== "auto" && current?.efforts.includes(reasoning)
      ? reasoning
      : "auto";
  // Screen readers hear where a search is, not every token of it.
  const spoken = (busy && searchStatus(messages.at(-1))) || announcement;
  const stores = searchedStores(messages);
  // Made again only when it changes, not with every streamed update.
  const header = useMemo(
    () => (
      <ChatHeader
        title={empty ? undefined : title}
        share={
          !readonly &&
          !empty && (
            <ShareDialog
              chatId={id}
              initialVisibility={visibility}
              stores={stores}
            />
          )
        }
      />
    ),
    [empty, title, readonly, id, visibility, stores],
  );

  useEffect(() => {
    document.title = title ? `${title} · Bread Chat` : "Bread Chat";
  }, [title]);

  // The first message glides the composer from the middle of the page to its dock.
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

  // Keys that work anywhere: type to write, Escape to stop.
  useWindowEvent("keydown", (event) => {
    if (readonly) return;
    const loose =
      document.activeElement === document.body &&
      !document.querySelector("[role=dialog]");
    if (event.key === "Escape" && busy && loose) {
      void stop();
      return;
    }
    if (
      loose &&
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      composer.current?.focus();
    }
    // ⌘⇧O on a fresh chat has nowhere to go but here.
    if (
      empty &&
      event.key.toLowerCase() === "o" &&
      event.shiftKey &&
      (event.metaKey || event.ctrlKey)
    ) {
      composer.current?.focus();
    }
  });

  /** Brings `questionId` to the top, with room below for its answer. */
  const answer = useCallback((questionId: string) => {
    setTurn((turn) => ({ id: questionId, key: (turn?.key ?? 0) + 1 }));
    setAnnouncement("");
  }, []);

  /** Sends `text` as a new question. Its id is made here, so the view can
   * pin it in the same frame it appears. */
  const sendQuestion = useCallback(
    (text: string) => {
      const question = generateId();
      answer(question);
      preloadMarkdown();
      void sendMessage(
        { id: question, role: "user", parts: [{ type: "text", text }] },
        {
          body: { model, reasoning: effort, sources: sources.selection.get() },
        },
      );
    },
    [answer, sendMessage, model, effort, sources],
  );

  /** Answers the last question again, as after a failure or a closed tab. */
  function answerAgain() {
    // The question is already there, so a refusal has nothing to take back.
    lastSend.current = null;
    const question = messages.findLast((message) => message.role === "user");
    if (question) answer(question.id);
    void regenerate({
      body: { model, reasoning: effort, sources: sources.selection.get() },
    });
  }

  // The same function while an answer streams, so the composer sits still.
  const send = useCallback(
    (text: string) => {
      clearError();
      lastSend.current = { text, first: empty };
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
      sendQuestion(text);
    },
    [clearError, empty, reduced, id, chats, sendQuestion],
  );

  function edit(messageId: string, text: string) {
    clearError();
    lastSend.current = { text, first: false, restore: messageId };
    setTree(withPath(tree, messages));
    setMessages(
      messages.slice(
        0,
        messages.findIndex((message) => message.id === messageId),
      ),
    );
    sendQuestion(text);
    composer.current?.focus();
  }

  function retry(messageId: string) {
    clearError();
    lastSend.current = { first: false, restore: messageId };
    setTree(withPath(tree, messages));
    const index = messages.findIndex((message) => message.id === messageId);
    const question = messages[index - 1];
    if (question) answer(question.id);
    void regenerate({
      messageId,
      body: { model, reasoning: effort, sources: sources.selection.get() },
    });
    composer.current?.focus();
  }

  /** Shows the branch through `messageId`, down its latest replies. */
  function switchTo(messageId: string) {
    const all = withPath(tree, messages);
    const replies = childrenOf(all);
    const leaf = latestLeaf(replies, messageId);
    setTree(all);
    clearError();
    setMessages(pathTo(all, leaf));
    void setChatLeaf(id, leaf);
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

  // Messages on screen at load stay still; others rise in when sent, or fade
  // in when a version switch brings them back from the saved tree.
  function appearOf(messageId: string): Appear {
    if (initial.shown.has(messageId)) return undefined;
    return initial.known.has(messageId) ? "fade" : "rise";
  }

  return (
    <div ref={frameRef} className="relative flex min-h-0 flex-1 flex-col">
      {header}

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
                retryLabel={
                  current ? `Try again with ${current.name}` : undefined
                }
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
          className={cn(
            leaving
              ? "pointer-events-none absolute z-10 motion-safe:animate-[fade_200ms_ease-out_reverse_both]"
              : "flex flex-1 flex-col justify-center pb-6 md:justify-end md:pb-9",
          )}
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
              inviting={empty}
            />
          </>
        )}
      </div>

      {empty && !readonly && (
        <div className="max-md:order-1 max-md:pb-3 md:flex-[1.2] md:pt-2">
          <Suggestions
            scope={scope}
            onPick={send}
            className="max-md:scroll-fade-x max-md:scrollbar-none max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:py-1 max-md:[--scroll-fade-size:1.25rem]"
          />
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </div>
  );
}

/** A question saved without its answer, as when the tab closed mid-way. */
function Unanswered({ onAnswer }: { onAnswer: () => void }) {
  return (
    <div className="mt-8 motion-safe:animate-fade">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 text-muted-foreground"
        onClick={onAnswer}
      >
        <CornerDownRightIcon />
        Answer
      </Button>
    </div>
  );
}

/** The latest search's progress in words: searching, or what it found. */
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
