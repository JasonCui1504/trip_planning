import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { TripStore } from "./db.ts";
import { createRegistry } from "./providers/index.ts";

const app = createApp(new TripStore(config.dataFile), createRegistry(config.keys));

// In production, serve the built web app from the same port.
const dist = resolve("dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

app.listen(config.port, () => {
  console.log(`Trip Workshop API listening on http://localhost:${config.port}`);
});
