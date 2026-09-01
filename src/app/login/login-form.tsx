"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Input } from "@/components/ui";
import { signIn, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" disabled={pending} className="w-full">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next ?? "/tracker"} />

      <Input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="username"
        required
        autoFocus
      />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
      />

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
