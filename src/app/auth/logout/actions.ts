"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logOut(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Sign out this browser session; keep other devices signed in.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return { error: "Could not log out. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
