import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { claudeCost, recordUsage } from "../usage";

let client: Anthropic | null = null;
export function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en el .env");
  client ??= new Anthropic();
  return client;
}

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

/** Llamada con salida estructurada validada por zod. */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  /** qué es, para el registro de costos */
  label?: string;
  /** URLs de imágenes para que Claude las vea (fotos de producto, referencias) */
  images?: string[];
  maxTokens?: number;
  model?: string;
}): Promise<z.infer<S>> {
  const res = await claude().messages.parse({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [
      {
        role: "user",
        content: opts.images?.length
          ? [
              ...opts.images.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
              { type: "text" as const, text: opts.user },
            ]
          : opts.user,
      },
    ],
    output_config: { format: zodOutputFormat(opts.schema) },
  });
  const model = opts.model ?? MODEL;
  void recordUsage({
    kind: "claude",
    detail: opts.label ?? "Claude",
    costUsd: claudeCost(model, res.usage.input_tokens, res.usage.output_tokens),
    units: { model, input: res.usage.input_tokens, output: res.usage.output_tokens },
  });
  if (res.parsed_output == null) {
    throw new Error(`Claude no regresó salida válida (stop_reason: ${res.stop_reason})`);
  }
  return res.parsed_output as z.infer<S>;
}

export const json = (v: unknown) => JSON.stringify(v, null, 2);

export const AGENCY_CONTEXT = `You work inside ROOTS ENGINE, the content engine of Purple Roots Agency (PRA), a bilingual video marketing agency in El Paso, TX serving the El Paso / Ciudad Juárez borderplex.
PRA's method, in this fixed order: 1) research the market, 2) win the attention of the right audience, 3) build community and die-hard fans with creative content, 4) only then, paid ads.
Clients are local businesses (barbershops, law firms, med spas, restaurants, gyms, bars, dentists, boutiques...). Many record themselves with a phone; keep every instruction simple and doable.
Never use em dashes or long dashes in any text you write. Use commas, periods or colons instead.`;
