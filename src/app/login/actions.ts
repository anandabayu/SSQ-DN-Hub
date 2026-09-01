"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/tracker");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // The message shown to the user stays deliberately vague — a distinct
    // "no such user" would let anyone enumerate which emails have accounts.
    // The real reason goes to the server log, where only the operator sees it.
    console.error("[login] sign-in failed:", {
      email,
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return { error: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/tracker");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
