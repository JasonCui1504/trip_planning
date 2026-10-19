import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Trip, Watch } from "../shared/types.ts";

/** Small cached blobs (e.g. the Chase Edit hotel list), with when they were saved. */
export interface CacheStore {
  getCache(key: string): Promise<{ value: string; savedAt: number } | null>;
  setCache(key: string, value: string): Promise<void>;
}

/** Where trips and price watches live: a JSON file locally, Redis when hosted. */
export interface Store extends CacheStore {
  list(): Promise<Trip[]>;
  get(id: string): Promise<Trip | undefined>;
  save(trip: Trip): Promise<Trip>;
  remove(id: string): Promise<boolean>;
  listWatches(): Promise<Watch[]>;
  getWatch(id: string): Promise<Watch | undefined>;
  saveWatch(watch: Watch): Promise<Watch>;
  removeWatch(id: string): Promise<boolean>;
}

/** Older records predate some fields; fill in defaults. */
export const upgradeTrip = (trip: Trip): Trip => ({ ...trip, scenarios: trip.scenarios ?? [] });

/**
 * A tiny JSON-file store for running on your own machine. Pass `null` for an
 * in-memory store (tests).
 */
export class TripStore implements Store {
  private cache = new Map<string, { value: string; savedAt: number }>();
  private trips = new Map<string, Trip>();
  private watches = new Map<string, Watch>();
  private loaded: Promise<void> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private file: string | null) {}

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      if (!this.file) return;
      try {
        const raw = JSON.parse(await readFile(this.file, "utf8")) as { trips?: Trip[]; watches?: Watch[] };
        for (const trip of raw.trips ?? []) this.trips.set(trip.id, upgradeTrip(trip));
        for (const watch of raw.watches ?? []) this.watches.set(watch.id, watch);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    })();
    return this.loaded;
  }

  private persist(): Promise<void> {
    const file = this.file;
    if (!file) return Promise.resolve();
    const snapshot = JSON.stringify({ trips: [...this.trips.values()], watches: [...this.watches.values()] }, null, 2);
    // Serialize writes and write-then-rename so a crash never leaves a half file.
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, snapshot);
      await rename(`${file}.tmp`, file);
    });
    return this.writing;
  }

  async list(): Promise<Trip[]> {
    await this.load();
    return [...this.trips.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async get(id: string): Promise<Trip | undefined> {
    await this.load();
    return this.trips.get(id);
  }

  async save(trip: Trip): Promise<Trip> {
    await this.load();
    this.trips.set(trip.id, trip);
    await this.persist();
    return trip;
  }

  async remove(id: string): Promise<boolean> {
    await this.load();
    const existed = this.trips.delete(id);
    if (existed) await this.persist();
    return existed;
  }

  async listWatches(): Promise<Watch[]> {
    await this.load();
    return [...this.watches.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getWatch(id: string): Promise<Watch | undefined> {
    await this.load();
    return this.watches.get(id);
  }

  async saveWatch(watch: Watch): Promise<Watch> {
    await this.load();
    this.watches.set(watch.id, watch);
    await this.persist();
    return watch;
  }

  async removeWatch(id: string): Promise<boolean> {
    await this.load();
    const existed = this.watches.delete(id);
    if (existed) await this.persist();
    return existed;
  }

  async getCache(key: string) {
    if (!this.file) return this.cache.get(key) ?? null;
    try {
      const file = this.cacheFile(key);
      const [info, value] = await Promise.all([stat(file), readFile(file, "utf8")]);
      return { value, savedAt: info.mtimeMs };
    } catch {
      return null;
    }
  }

  async setCache(key: string, value: string) {
    if (!this.file) return void this.cache.set(key, { value, savedAt: Date.now() });
    const file = this.cacheFile(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, value);
  }

  private cacheFile(key: string) {
    return join(dirname(this.file!), `cache-${key.replace(/[^a-z0-9-]/gi, "_")}.json`);
  }
}
