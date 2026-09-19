"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Check your email for a password reset link.",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email and we will send you a password reset link.
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

          <button
            type="button"
            onClick={handleReset}
            disabled={loading || !email}
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <Link
            href="/login"
            className="block text-center text-sm font-medium text-gray-700 underline"
          >
            Back to Sign In
          </Link>

          {message && (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
