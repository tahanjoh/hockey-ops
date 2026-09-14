"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/";
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Check your email if confirmation is required.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Hockey Ops</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to track player performance.
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-base"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-base"
          />

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full rounded-xl border px-4 py-3 font-semibold"
          >
            Create Account
          </button>

          {message && (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}