"use client";

import { useActionState } from "react";
import { logOut } from "@/app/auth/logout/actions";

export default function AccountControls({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(logOut, { error: null });

  return (
    <div className="mb-6 rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">Signed in as</p>
          <p className="break-all text-sm font-semibold">{email ?? "Your account"}</p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Logging out…" : "Log Out"}
          </button>
        </form>
      </div>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
