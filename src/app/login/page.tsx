"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    router.push("/");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");

    if (password.length < 8) {
      setLoading(false);
      setMessage("Password must be at least 8 characters.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Account created. Check your email and click the confirmation link to finish signing up.",
    );
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
            autoComplete="email"
            className="w-full rounded-xl border px-4 py-3 text-base"
          />

          <div className="space-y-2">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border px-4 py-3 pr-16 text-base"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-gray-500">
                New accounts: use at least 8 characters.
              </span>

              <Link
                href="/forgot-password"
                className="shrink-0 font-medium text-gray-700 underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"
          >
            Create New Account
          </button>

          {message && (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
