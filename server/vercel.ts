import type { Request, Response } from "express";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { config } from "./config.ts";
import { createEditCatalog } from "./edit.ts";
import { createMaps } from "./maps.ts";
import { createRegistry } from "./providers/index.ts";
import { RedisStore, redisConfigFromEnv } from "./redis.ts";

/**
 * Entry point for Vercel. Each request runs the same Express app as local
 * development, but storage is Redis (Vercel's filesystem doesn't persist) and
 * the daily price check comes from Vercel Cron instead of a timer.
 * Bundled to build/server.mjs by `npm run build:vercel`; api/index.js serves it.
 */

const redis = redisConfigFromEnv();

function misconfigured(message: string) {
  return (_req: Request, res: Response) => res.status(503).json({ error: message });
}

function build() {
  if (!redis) return misconfigured("Storage isn't set up: in Vercel, open the project → Storage → add Upstash Redis, then redeploy.");
  if (!config.appPassword) return misconfigured("APP_PASSWORD isn't set: add it under Settings → Environment Variables, then redeploy.");
  const store = new RedisStore(redis);
  const edit = createEditCatalog({ cache: store });
  return createApp({
    store,
    registry: createRegistry(config.keys, { edit }),
    maps: createMaps({ googleKey: config.googleMapsKey, offline: config.mapsOffline }),
    edit,
    auth: createAuth({ password: config.appPassword, secret: config.sessionSecret }),
    cronSecret: config.cronSecret,
  });
}

export default build();
