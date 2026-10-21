"use server";

import { revalidatePath } from "next/cache";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelPost } from "@/server/publishing";

/** Cancela un post programado. */
export async function cancelPostAction(clientId: string, postId: string) {
  await requireClientAccess(clientId);
  await cancelPost(supabaseAdmin(), clientId, postId);
  revalidatePath(`/c/${clientId}/publicar`);
}
