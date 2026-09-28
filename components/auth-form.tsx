"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
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
      setError(result.error.message ?? "Something went wrong.");
      setPending(false);
      return;
    }
    // A full load, so every server component sees the new session.
    window.location.href = "/";
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            aria-invalid={Boolean(error)}
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" disabled={pending}>
          {mode === "login" ? "Log in" : "Sign up"}
        </Button>
      </FieldGroup>
    </form>
  );
}
