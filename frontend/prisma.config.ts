import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "prisma/config";

// Studio is a development tool. SQL migrations remain owned by the Python app.
process.env.CHECKPOINT_DISABLE = "1";
let url = process.env.QUOTATION_DATABASE_URL;
if (url === undefined) {
  try {
    const local = parseEnv(readFileSync(new URL("../backend/.env", import.meta.url), "utf8"));
    url = local.QUOTATION_DATABASE_URL;
  } catch {
    throw new Error("Cannot read backend/.env. Configure QUOTATION_DATABASE_URL for Studio.");
  }
}
if (!url?.trim()) {
  throw new Error("Configure QUOTATION_DATABASE_URL in backend/.env before starting Studio.");
}
try {
  const connection = new URL(url);
  if (!["postgres:", "postgresql:"].includes(connection.protocol)) throw new Error();
} catch {
  throw new Error("QUOTATION_DATABASE_URL must be a PostgreSQL connection URI.");
}

export default defineConfig({ datasource: { url } });
