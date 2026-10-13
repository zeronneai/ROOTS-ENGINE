/** Revisa que la compu esté lista para correr el worker: npm run check */
import "./load-env";
import { execFileSync } from "node:child_process";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => {
  console.log(`  ✗ ${m}`);
  failed = true;
};
let failed = false;

(async () => {
  console.log("\nRevisando ROOTS ENGINE worker...\n");
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node}: necesitas la versión 20 o más nueva (nodejs.org)`);

  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    ok("ffmpeg instalado");
  } catch {
    bad("ffmpeg no encontrado. En PowerShell: winget install Gyan.FFmpeg  y luego cierra y abre la terminal");
  }

  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) {
    if (process.env[k]) ok(`${k} configurada`);
    else bad(`Falta ${k} en el archivo .env.local`);
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { supabaseAdmin } = await import("../src/lib/supabase/admin");
      const { count, error } = await supabaseAdmin().from("clients").select("id", { count: "exact", head: true });
      if (error) throw error;
      ok(`Conexión a Supabase (${count ?? 0} clientes)`);
    } catch (e) {
      bad(`No pude conectar a Supabase: ${(e as Error).message}`);
    }
  }

  console.log(`\n  Transcripción: ${process.env.TRANSCRIBE_PROVIDER || "local"} · modelo ${process.env.WHISPER_MODEL || "small"}`);
  console.log(failed ? "\n✗ Arregla lo de arriba y vuelve a correr: npm run check\n" : "\n✓ Todo listo. Ahora: npm run worker\n");
  process.exit(failed ? 1 : 0);
})();
