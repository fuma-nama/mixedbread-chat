"use client";

import { cn } from "cn";
import { isValidElement, useContext } from "react";
import {
  CodeBlock,
  type ExtraProps,
  StreamdownContext,
  useIsCodeFenceIncomplete,
} from "streamdown";
import { BlockActions, save } from "./block-actions";

export function Code({
  node: _,
  className,
  children,
  ...props
}: React.ComponentProps<"code"> & ExtraProps) {
  const { isAnimating, lineNumbers } = useContext(StreamdownContext);
  const incomplete = useIsCodeFenceIncomplete();

  // Streamdown marks the code inside a fence; anything else is inline.
  if (!("data-block" in props)) {
    return (
      <code
        data-streamdown="inline-code"
        className={cn(
          "rounded-[0.3rem] bg-muted px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-foreground inset-ring inset-ring-soft",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  const { "data-block": _block, ...rest } = props as typeof props & {
    "data-block": string;
  };
  const language = className?.match(/language-(\S+)/)?.[1] ?? "";
  const code = textOf(children);

  return (
    <CodeBlock
      code={code}
      language={language}
      isIncomplete={incomplete}
      lineNumbers={lineNumbers}
      // The body is what scrolls; its edge fades while long lines run past it.
      className={cn(className, "scroll-fade-x")}
      {...rest}
    >
      {!isAnimating && (
        <BlockActions
          what="code"
          copy={() => navigator.clipboard.writeText(code)}
          download={() =>
            save(code, `code.${extensionOf(language)}`, "text/plain")
          }
        />
      )}
    </CodeBlock>
  );
}

function textOf(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (isValidElement<{ children?: unknown }>(children)) {
    const inner = children.props.children;
    if (typeof inner === "string") return inner;
  }
  return "";
}

const extensions: Record<string, string> = {
  "c#": "cs",
  "c++": "cpp",
  bash: "sh",
  csharp: "cs",
  golang: "go",
  javascript: "js",
  kotlin: "kt",
  markdown: "md",
  plaintext: "txt",
  python: "py",
  ruby: "rb",
  rust: "rs",
  shell: "sh",
  text: "txt",
  typescript: "ts",
  yaml: "yml",
  zsh: "sh",
};

/** A file extension for code in `language`: its usual one, else the name itself. */
function extensionOf(language: string): string {
  const name = language.toLowerCase();
  if (Object.hasOwn(extensions, name)) return extensions[name];
  return /^[a-z0-9]{1,10}$/.test(name) ? name : "txt";
}
