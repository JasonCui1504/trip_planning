import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { config } from "./config.ts";
import { TripStore } from "./db.ts";
import { createEditCatalog } from "./edit.ts";
import { createMaps } from "./maps.ts";
import { createRegistry } from "./providers/index.ts";
import { startWatcher } from "./watch.ts";

const store = new TripStore(config.dataFile);
const edit = createEditCatalog({ cache: store });
const registry = createRegistry(config.keys, { edit });
const maps = createMaps({ googleKey: config.googleMapsKey, offline: config.mapsOffline });
const auth = createAuth({ password: config.appPassword, secret: config.sessionSecret });
const app = createApp({ store, registry, maps, edit, auth, cronSecret: config.cronSecret });

// In production, serve the built web app from the same port.
const dist = resolve("dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

app.listen(config.port, () => {
  console.log(`Trip Workshop API listening on http://localhost:${config.port}`);
  console.log(`Routing: ${config.mapsOffline ? "offline estimates" : maps.routingProvider}`);
  startWatcher(store, registry, config.watchIntervalMinutes);
});
