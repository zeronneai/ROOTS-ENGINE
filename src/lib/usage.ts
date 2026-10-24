import { AsyncLocalStorage } from "node:async_hooks";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Registro de costos: cada llamada a Claude, Apify, Google (imágenes) y cada render guarda cuánto costó
 * y de qué cliente fue. Se ve en /agency/costos (solo la agencia).
 *
 * Los precios son de las listas públicas (USD). Si cambian, se ajustan aquí.
 */
export const PRICES = {
  claude: {
    // USD por millón de tokens [entrada, salida]
    "claude-sonnet-5-5": [2, 10],
    "claude-opus-5-5": [4, 20],
    "claude-haiku-5-5": [0.1, 0.5],
  } as Record<string, [number, number]>,
  /** USD por resultado de Apify (pay per result, plan Free/Starter) */
  apify: {
    "apify~instagram-reel-scraper": 0.0026,
    "apify~instagram-hashtag-scraper": 0.0026,
    "apify~instagram-profile-scraper": 0.0026,
    "clockworks~tiktok-scraper": 0.0017,
    "compass~crawler-google-places": 0.002,
  } as Record<string, number>,
  /** Nano Banana por imagen según tamaño */
  geminiImage: { "1K": 0.0336, "2K": 0.0504, "4K": 0.113 } as Record<string, number>,
  /** Remotion for Automators */
  render: 0.01,
};

/**
 * Costos fijos mensuales (USD). Arrancan en 0 porque hoy todo está en planes gratis.
 * Cuando pases a un plan de pago, pon su precio en Vercel → Environment Variables (COST_VERCEL=20, etc.).
 */
const fixed = (env: string | undefined) => Number(env ?? 0) || 0;
export const FIXED_MONTHLY = [
  { name: "Vercel", usd: fixed(process.env.COST_VERCEL), paidHint: "Pro: 20 USD (obligatorio al cobrarle a clientes)" },
  { name: "Supabase", usd: fixed(process.env.COST_SUPABASE), paidHint: "Pro: 25 USD (videos de más de 50 MB y más espacio)" },
  { name: "Apify", usd: fixed(process.env.COST_APIFY), credit: "apify" as const, paidHint: "Starter: 19 USD, trae 19 USD de crédito" },
  { name: "Remotion", usd: fixed(process.env.COST_REMOTION), credit: "render" as const, paidHint: "Gratis hasta 3 personas en la empresa" },
];

export type UsageKind = "claude" | "apify" | "gemini" | "render";

const ctx = new AsyncLocalStorage<{ clientId: string | null }>();

/** Todo lo que se gaste dentro de `fn` se le carga a este cliente. */
export function runWithClient<T>(clientId: string | null, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ clientId }, fn);
}

export async function recordUsage(e: { kind: UsageKind; detail: string; costUsd: number; units?: Record<string, unknown>; clientId?: string | null }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !Number.isFinite(e.costUsd)) return;
  try {
    await supabaseAdmin()
      .from("usage_events")
      .insert({
        client_id: e.clientId !== undefined ? e.clientId : (ctx.getStore()?.clientId ?? null),
        kind: e.kind,
        detail: e.detail.slice(0, 120),
        units: e.units ?? {},
        cost_usd: +e.costUsd.toFixed(5),
      });
  } catch {
    // el registro de costos nunca debe romper el trabajo real
  }
}

export function claudeCost(model: string, inputTokens: number, outputTokens: number) {
  const key = Object.keys(PRICES.claude).find((k) => model.startsWith(k)) ?? "claude-sonnet-5-5";
  const [i, o] = PRICES.claude[key];
  return (inputTokens * i + outputTokens * o) / 1e6;
}
