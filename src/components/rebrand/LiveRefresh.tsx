"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresca la página cada pocos segundos mientras algo se está generando. */
export function LiveRefresh({ every = 8000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
