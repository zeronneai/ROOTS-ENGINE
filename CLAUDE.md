@AGENTS.md

# ROOTS ENGINE

Content engine for Purple Roots Agency (bilingual video agency, El Paso / Juárez). See README.md for the product.

## Rules
- Never use em dashes or long dashes in any UI copy, prompts or generated text. Use commas, periods or colons.
- UI copy is in Spanish (Mexican, casual, "tú"). Code comments may be Spanish.
- Next.js 16 App Router: `params`/`searchParams`/`cookies()` are async. `src/proxy.ts` replaces middleware.

## Map
- `src/lib/styles/` edit style presets per niche, layered resolution (`resolveStyle`), energy scaling.
- `src/lib/edl/` Edit Decision List: `heuristicDirection`, `buildEdl`, `makeTimeMap` (source time to output time).
- `src/remotion/` the auto-edit composition (`AutoEdit`, `Captions`, fonts). Same component powers the live Player preview and the MP4 render.
- `src/lib/ai/` Claude calls with structured output (`structured()` in `claude.ts`): brand synthesis, post analysis, weekly planner, edit direction, moods.
- `src/server/engine.ts` business logic shared by API routes and the worker. Uses the Supabase service role client.
- `scripts/worker.ts` polls `edits.status`: queued → transcribing → directing → review → render_queued → rendering → done.
- `supabase/migrations/` schema + RLS. Agency role sees everything; client role sees only its `client_id`.

## Commands
- `npm run typecheck`, `npx eslint src scripts`, `npx next build`
- `npm run demo:styles` renders the sample clip in every preset to `out/demo` (needs ffmpeg/Chrome).
