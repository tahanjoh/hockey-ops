"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("Updating password...");

    try {
      // Recovery emails can return tokens in the URL fragment, while
      // this app normally uses PKCE. Explicitly establish that session.
      const recoveryHash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = recoveryHash.get("access_token");
      const refreshToken = recoveryHash.get("refresh_token");
      if (recoveryHash.get("type") === "recovery" && accessToken && refreshToken) {
        const { error: recoveryError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (recoveryError) {
          setMessage("Unable to open this recovery session. Request a fresh reset link from this app.");
          setLoading(false);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      let { data: { session } } = await supabase.auth.getSession();
      const recoveryCode = new URLSearchParams(window.location.search).get("code");
      if (!session && recoveryCode) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(recoveryCode);
        if (exchangeError) {
          setMessage("Open a fresh reset link in the same browser that requested it.");
          setLoading(false);
          return;
        }
        session = data.session;
        window.history.replaceState(null, "", window.location.pathname);
      }

      if (!session) {
        setMessage(
          "Your password reset session has expired or is invalid. Please request a new reset link.",
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage("Password updated successfully.");

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Password update failed:", error);
      setMessage("Something went wrong. Please request a new reset link and try again.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create New Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose a new password with at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
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

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-xl border px-4 py-3 text-base"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>

          {message && (
            <p className="text-sm text-gray-600">{message}</p>
          )}
        </form>
      </div>
    </main>
  );
}
