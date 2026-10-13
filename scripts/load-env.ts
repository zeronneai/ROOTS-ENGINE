// Carga .env.local / .env para los scripts (Next lo hace solo en la app).
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
