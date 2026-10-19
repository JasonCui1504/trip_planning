// Bundles the API server into a single ESM file for Vercel (build/server.mjs).
import { build } from "esbuild";

await build({
  entryPoints: ["server/vercel.ts"],
  outfile: "build/server.mjs",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // Express and friends are CommonJS; give the ESM bundle a require().
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
