"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarga los datos de la página cada ciertos segundos mientras algo se está procesando. */
export function AutoRefresh({ every = 8000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
