"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/use-media";

/** Types itself out whenever it changes after the first render. */
export function TypedText({
  text,
  instant = false,
}: {
  text: string;
  /** Show a change at once, as after the reader renamed something. */
  instant?: boolean;
}) {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState({ text, length: text.length });
  if (typed.text !== text) {
    setTyped({ text, length: instant || reduced ? text.length : 0 });
  }
  const done = typed.length >= typed.text.length;

  useEffect(() => {
    if (done) return;
    const timer = setInterval(
      () => setTyped((typed) => ({ ...typed, length: typed.length + 1 })),
      22,
    );
    return () => clearInterval(timer);
  }, [done]);

  return text.slice(0, typed.length) || " ";
}
