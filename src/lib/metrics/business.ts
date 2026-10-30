import "server-only";

/**
 * Números del negocio desde la app del propio cliente (hoy: la app de membresías de Torque).
 * La app regresa solo conteos y montos, nunca nombres ni correos. Llave compartida: ROOTS_METRICS_KEY.
 */

type Count = { name: string; n: number };
export type BusinessMetrics = {
  days: number;
  currency: string;
  revenue: { total: number; previous: number; payments: number; byDay: Record<string, number> };
  leads: { total: number; previous: number; byDay: Record<string, number>; bySource: Count[]; byStatus: Count[]; converted: number } | null;
  members: {
    active: number;
    new: number;
    previousNew: number;
    byDay: Record<string, number>;
    newByPackage: Count[];
    newByPlan: Count[];
    activeByPackage: Count[];
    cancellations: number;
    cancelReasons: Count[];
  } | null;
  teams: { active: number; new: number } | null;
  tryouts: number | null;
  events: number | null;
};

export async function fetchBusinessMetrics(url: string, days: number): Promise<BusinessMetrics> {
  const key = process.env.ROOTS_METRICS_KEY;
  if (!key) throw new Error("Falta ROOTS_METRICS_KEY en Vercel (la misma que en la app del cliente)");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-metrics-key": key },
    body: JSON.stringify({ action: "metrics", days }),
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(60000),
  } as RequestInit);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(res.status === 403 ? "La llave ROOTS_METRICS_KEY no coincide con la de la app del cliente" : `La app respondió ${res.status}`);
  return data as BusinessMetrics;
}
