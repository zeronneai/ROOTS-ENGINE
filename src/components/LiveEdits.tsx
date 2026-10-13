"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Escucha en tiempo real los cambios de los videos (Supabase Realtime) y refresca la página al instante.
 * Si Realtime no está disponible, `poll` hace de respaldo revisando cada 8 segundos.
 */
export function LiveEdits({ editId, clientId, poll = false }: { editId?: string; clientId?: string; poll?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const filter = editId ? `id=eq.${editId}` : `client_id=eq.${clientId}`;
    const db = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = db
      .channel(`edits-${editId ?? clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "edits", filter }, refresh)
      .subscribe();
    const interval = poll ? setInterval(() => router.refresh(), 8000) : null;
    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
      db.removeChannel(channel);
    };
  }, [editId, clientId, poll, router]);
  return null;
}
