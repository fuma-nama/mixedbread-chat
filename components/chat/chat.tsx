"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { setChatLeaf } from "@/app/(chat)/actions";
import { useChats } from "@/components/sidebar/chats-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { latestLeaf, pathTo, siblingsOf } from "@/lib/branches";
import type { Source } from "@/lib/mixedbread/citations";
import type { ModelId } from "@/lib/models";
import type { ChatMessage } from "@/lib/search-tool";
import { ChatHeader } from "./chat-header";
import { Conversation } from "./conversation";
import { type Citations, Markdown } from "./markdown";
import { Message, MessageBubble } from "./message";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { PromptInput } from "./prompt-input";
import { Reasoning } from "./reasoning";
import { Search } from "./search";
import { Sources } from "./sources";

/** A message with its place in the chat's branch tree. */
export type TreeMessage = ChatMessage & { parentId: string | null };

export function Chat({
  id,
  initialMessages,
  initialLeafId,
  initialModel,
  visibility,
  readonly = false,
}: {
  id: string;
  initialMessages: TreeMessage[];
  initialLeafId: string | null;
  initialModel: ModelId;
  visibility: "private" | "public";
  /** Someone else's shared chat. */
  readonly?: boolean;
}) {
  const { refresh } = useChats();
  const [tree, setTree] = useState(initialMessages);
  const [model, setModel] = useState(initialModel);
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        // New messages and retries both end with the user message to answer.
        prepareSendMessagesRequest: ({ id, messages, body }) => ({
          body: {
            ...body,
            id,
            message: messages.at(-1),
            parentId: messages.at(-2)?.id ?? null,
          },
        }),
      }),
  );
  const [initialPath] = useState(() =>
    withoutParents(
      pathTo(
        initialMessages,
        initialLeafId ?? initialMessages.at(-1)?.id ?? null,
      ),
    ),
  );
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
    messages: initialPath,
    transport,
    onFinish: refresh,
  });

  // A new chat is saved before its first answer streams; list it right away.
  const listed = useRef(initialMessages.length > 0);
  useEffect(() => {
    if (status === "streaming" && !listed.current) {
      listed.current = true;
      refresh();
    }
  }, [status, refresh]);

  const busy = status === "submitted" || status === "streaming";
  const all = useMemo(() => withPath(tree, messages), [tree, messages]);
  const sources = useMemo(() => collectSources(messages), [messages]);

  function send(text: string) {
    if (messages.length === 0)
      window.history.replaceState(null, "", `/c/${id}`);
    void sendMessage({ text }, { body: { model } });
  }

  function edit(index: number, text: string) {
    setTree(all);
    setMessages(messages.slice(0, index));
    void sendMessage({ text }, { body: { model } });
  }

  function retry(messageId: string) {
    setTree(all);
    void regenerate({ messageId, body: { model } });
  }

  function switchTo(messageId: string) {
    setTree(all);
    const leaf = latestLeaf(all, messageId);
    clearError();
    setMessages(withoutParents(pathTo(all, leaf)));
    void setChatLeaf(id, leaf);
  }

  const composer = !readonly && (
    <PromptInput status={status} onSubmit={send} onStop={stop} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        chatId={id}
        model={readonly ? undefined : model}
        onModelChange={setModel}
        visibility={!readonly && messages.length > 0 ? visibility : undefined}
      />
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-[12vh]">
          <h1 className="px-4 text-center font-heading font-semibold text-2xl">
            What do you want to know?
          </h1>
          {composer}
        </div>
      ) : (
        <>
          <Conversation>
            {messages.map((message, index) => (
              <ChatMessageView
                key={message.id}
                message={message}
                sources={sources}
                streaming={busy && index === messages.length - 1}
                versions={siblingsOf(all, messages[index - 1]?.id ?? null)}
                actions={!readonly && !busy}
                onEdit={(text) => edit(index, text)}
                onRetry={() => retry(message.id)}
                onSwitch={switchTo}
              />
            ))}
            {status === "submitted" && (
              <Spinner className="text-muted-foreground" />
            )}
            {error && (
              <div className="flex items-center gap-3 text-destructive text-sm">
                {error.message || "Something went wrong."}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void regenerate({ body: { model } })}
                >
                  Retry
                </Button>
              </div>
            )}
          </Conversation>
          {composer}
        </>
      )}
    </div>
  );
}

function ChatMessageView({
  message,
  sources,
  streaming,
  versions,
  actions,
  onEdit,
  onRetry,
  onSwitch,
}: {
  message: ChatMessage;
  sources: Map<string, Source>;
  streaming: boolean;
  /** This message and its edits or retries. */
  versions: TreeMessage[];
  actions: boolean;
  onEdit: (text: string) => void;
  onRetry: () => void;
  onSwitch: (messageId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const citations = useMemo(
    () => citationsOf(message, sources),
    [message, sources],
  );

  if (editing) {
    return (
      <Message from={message.role}>
        <MessageEditor
          defaultValue={textOf(message)}
          onCancel={() => setEditing(false)}
          onSubmit={(text) => {
            setEditing(false);
            onEdit(text);
          }}
        />
      </Message>
    );
  }

  return (
    <Message from={message.role}>
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return message.role === "user" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only and text parts have no id
              <MessageBubble key={index}>{part.text}</MessageBubble>
            ) : (
              <Markdown
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only and text parts have no id
                key={index}
                citations={citations}
                isAnimating={streaming}
              >
                {part.text}
              </Markdown>
            );
          case "reasoning":
            return (
              <Reasoning
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only and reasoning parts have no id
                key={index}
                text={part.text}
                streaming={part.state === "streaming"}
              />
            );
          case "tool-search":
            return <Search key={part.toolCallId} part={part} />;
          default:
            return null;
        }
      })}
      {!streaming && (
        <>
          <Sources citations={citations} />
          <MessageActions
            from={message.role}
            text={textOf(message)}
            versions={versions.map((version) => version.id)}
            current={message.id}
            onSwitch={actions ? onSwitch : undefined}
            onEdit={
              actions && message.role === "user"
                ? () => setEditing(true)
                : undefined
            }
            onRetry={
              actions && message.role === "assistant" ? onRetry : undefined
            }
          />
        </>
      )}
    </Message>
  );
}

function withoutParents(messages: TreeMessage[]): ChatMessage[] {
  return messages.map(({ parentId: _, ...message }) => message);
}

/** The tree, plus any message on the current path it has not seen yet. */
function withPath(tree: TreeMessage[], path: ChatMessage[]): TreeMessage[] {
  const known = new Set<string>();
  for (const message of tree) known.add(message.id);

  let merged = tree;
  for (let i = 0; i < path.length; i++) {
    if (known.has(path[i].id)) continue;
    if (merged === tree) merged = [...tree];
    merged.push({ ...path[i], parentId: path[i - 1]?.id ?? null });
  }
  return merged;
}

/** The message's text as the user sees it, without citation links. */
function textOf(message: ChatMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text.replace(CITATION_LINK, "");
}

const CITATION_LINK = /\[[^\]]*\]\(#S\d+\)/g;
const CITATION = /\]\(#(S\d+)\)/g;

/** Every labelled source the conversation's searches found. */
function collectSources(messages: ChatMessage[]): Map<string, Source> {
  const sources = new Map<string, Source>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search" || part.state !== "output-available")
        continue;
      if (part.output.status !== "done") continue;
      for (const source of part.output.sources) {
        sources.set(source.label, source);
      }
    }
  }
  return sources;
}

function citationsOf(
  message: ChatMessage,
  sources: Map<string, Source>,
): Citations {
  const citations: Citations = new Map();
  for (const part of message.parts) {
    if (part.type !== "text") continue;
    for (const [, label] of part.text.matchAll(CITATION)) {
      const source = sources.get(label);
      if (source && !citations.has(label)) {
        citations.set(label, { number: citations.size + 1, source });
      }
    }
  }
  return citations;
}
