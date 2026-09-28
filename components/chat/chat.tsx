"use client";

import { useChat } from "@ai-sdk/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Source } from "@/lib/mixedbread/citations";
import type { ChatMessage } from "@/lib/search-tool";
import { Conversation } from "./conversation";
import { type Citations, Markdown } from "./markdown";
import { Message, MessageBubble } from "./message";
import { PromptInput } from "./prompt-input";
import { Search } from "./search";
import { Sources } from "./sources";

export function Chat() {
  const { messages, sendMessage, status, stop, error, regenerate } =
    useChat<ChatMessage>();
  const sources = useMemo(() => collectSources(messages), [messages]);

  return (
    <div className="flex h-dvh flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <h1 className="font-heading font-semibold text-2xl">
            What do you want to know?
          </h1>
          <p className="text-muted-foreground">
            Answers cite your documents and the web.
          </p>
        </div>
      ) : (
        <Conversation>
          {messages.map((message, index) => (
            <ChatMessageView
              key={message.id}
              message={message}
              sources={sources}
              streaming={
                status === "streaming" && index === messages.length - 1
              }
            />
          ))}
          {status === "submitted" && (
            <Spinner className="text-muted-foreground" />
          )}
          {error && (
            <div className="flex items-center gap-3 text-destructive text-sm">
              Something went wrong.
              <Button variant="outline" size="sm" onClick={() => regenerate()}>
                Retry
              </Button>
            </div>
          )}
        </Conversation>
      )}
      <PromptInput
        status={status}
        onSubmit={(text) => sendMessage({ text })}
        onStop={stop}
      />
    </div>
  );
}

function ChatMessageView({
  message,
  sources,
  streaming,
}: {
  message: ChatMessage;
  sources: Map<string, Source>;
  streaming: boolean;
}) {
  const citations = useMemo(
    () => citationsOf(message, sources),
    [message, sources],
  );

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
          case "tool-search":
            return <Search key={part.toolCallId} part={part} />;
          default:
            return null;
        }
      })}
      {!streaming && <Sources citations={citations} />}
    </Message>
  );
}

const CITATION = /\]\(#(S\d+)\)/g;

/** Every labelled source the conversation's searches found. */
function collectSources(messages: ChatMessage[]): Map<string, Source> {
  const sources = new Map<string, Source>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search" || part.state !== "output-available")
        continue;
      if (part.output.status !== "done") continue;
      for (const source of part.output.sources)
        sources.set(source.label, source);
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
