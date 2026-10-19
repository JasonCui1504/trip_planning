import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Trip, Watch } from "../shared/types.ts";

/**
 * A tiny JSON-file store. Good enough for a single-user prototype; swap for
 * SQLite/Postgres when multiple people need to share trips.
 */
export class TripStore {
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
        // Older files predate scenarios; fill in defaults.
        for (const trip of raw.trips ?? []) this.trips.set(trip.id, { ...trip, scenarios: trip.scenarios ?? [] });
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
}
