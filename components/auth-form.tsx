"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { IconSwap } from "@/components/ui/icon-swap";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { withNext } from "@/lib/safe-next";

const copy = {
  login: {
    title: "Log in",
    submit: "Log in",
    pending: "Logging in…",
    other: "No account yet?",
    otherLink: "Sign up",
  },
  register: {
    title: "Sign up",
    submit: "Sign up",
    pending: "Signing up…",
    other: "Have an account?",
    otherLink: "Log in",
  },
};

/** The log-in and sign-up page: a title, the form, and the way to the other one. */
export function AuthPage({
  mode,
  next,
}: {
  mode: "login" | "register";
  next: string;
}) {
  const text = copy[mode];
  const other = mode === "login" ? "/register" : "/login";

  return (
    <>
      <h1 className="mt-6 text-[1.75rem] leading-[1.15] font-normal tracking-[-0.025em] motion-safe:animate-rise motion-safe:[animation-delay:60ms]">
        {text.title}
      </h1>
      <AuthForm
        mode={mode}
        next={next}
        className="mt-8 motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
      />
      <p className="mt-6 text-[13.5px] text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:180ms]">
        {text.other}{" "}
        <Link
          href={withNext(other, next)}
          className="text-foreground underline decoration-foreground/25 underline-offset-3 outline-offset-2 outline-ring transition-[text-decoration-color] hover:decoration-foreground focus-visible:outline-2"
        >
          {text.otherLink}
        </Link>
      </p>
    </>
  );
}

interface Failure {
  text: string;
  /** The email already has an account, so offer to log in instead. */
  login?: boolean;
}

interface Attempt {
  error?: Failure;
  /** Signed in, and on the way to `next`. */
  done?: boolean;
}

function AuthForm({
  mode,
  next,
  className,
}: {
  mode: "login" | "register";
  next: string;
  className: string;
}) {
  const [visible, setVisible] = useState(false);
  const text = copy[mode];
  const [state, submit, pending] = useActionState<Attempt, FormData>(
    async (_, form) => {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      const result =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: email.split("@")[0],
            });
      if (result.error) {
        return { error: failureOf(result.error.code, result.error.message) };
      }
      // A full load, so every server component sees the new session.
      window.location.href = next;
      return { done: true };
    },
    {},
  );
  // A new attempt clears the last one's error.
  const error = pending ? undefined : state.error;

  return (
    <form action={submit} className={className}>
      <FieldGroup className="w-full text-left">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the page's one task
            autoFocus
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={
                mode === "register" ? "At least 8 characters" : undefined
              }
              aria-invalid={Boolean(error)}
              required
              className="pr-10"
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              onClick={() => setVisible((visible) => !visible)}
              className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-offset-2 outline-ring transition-colors hover:bg-soft hover:text-foreground focus-visible:outline-2"
            >
              <IconSwap
                swapped={visible}
                from={<EyeIcon className="size-4" />}
                to={<EyeOffIcon className="size-4" />}
              />
            </button>
          </div>
        </Field>
        {error && (
          <FieldError>
            {error.text}
            {error.login && (
              <>
                {" "}
                <Link
                  href={withNext("/login", next)}
                  className="underline underline-offset-3 outline-offset-2 outline-ring focus-visible:outline-2"
                >
                  Log in
                </Link>
              </>
            )}
          </FieldError>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending || state.done}
          className="mt-2"
        >
          {pending || state.done ? text.pending : text.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}

function failureOf(code?: string, message?: string): Failure {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return { text: "That email and password don’t match." };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        text: "There’s already an account with this email.",
        login: true,
      };
    case "PASSWORD_TOO_SHORT":
      return { text: "Use at least 8 characters." };
    case "INVALID_EMAIL":
      return { text: "That doesn’t look like an email address." };
    default:
      return { text: message ?? "Something went wrong. Try again." };
  }
}
