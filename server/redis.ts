import type { Trip, Watch } from "../shared/types.ts";
import { upgradeTrip, type Store } from "./db.ts";

/**
 * Store backed by Upstash Redis over its REST API, for hosting on Vercel
 * (where the filesystem doesn't persist). Vercel's Upstash integration sets
 * KV_REST_API_URL / KV_REST_API_TOKEN; plain Upstash uses the UPSTASH_* names.
 *
 * Layout: hash "tw:trips" and hash "tw:watches" (id → JSON), and
 * "tw:cache:<key>" strings holding { value, savedAt }.
 */

export interface RedisConfig {
  url: string;
  token: string;
}

export function redisConfigFromEnv(env = process.env): RedisConfig | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const TRIPS = "tw:trips";
const WATCHES = "tw:watches";

export class RedisStore implements Store {
  constructor(
    private config: RedisConfig,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async command<T>(...args: (string | number)[]): Promise<T> {
    const res = await this.fetchImpl(this.config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || data.error) throw new Error(`Redis ${args[0]} failed: ${data.error ?? res.status}`);
    return data.result as T;
  }

  /** HGETALL comes back as a flat [field, value, field, value…] list. */
  private async values<T>(hash: string): Promise<T[]> {
    const flat = (await this.command<string[] | null>("HGETALL", hash)) ?? [];
    const out: T[] = [];
    for (let i = 1; i < flat.length; i += 2) out.push(JSON.parse(flat[i]) as T);
    return out;
  }

  private async one<T>(hash: string, id: string): Promise<T | undefined> {
    const raw = await this.command<string | null>("HGET", hash, id);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }

  async list() {
    return (await this.values<Trip>(TRIPS)).map(upgradeTrip).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async get(id: string) {
    const trip = await this.one<Trip>(TRIPS, id);
    return trip && upgradeTrip(trip);
  }

  async save(trip: Trip) {
    await this.command("HSET", TRIPS, trip.id, JSON.stringify(trip));
    return trip;
  }

  async remove(id: string) {
    return (await this.command<number>("HDEL", TRIPS, id)) > 0;
  }

  async listWatches() {
    return (await this.values<Watch>(WATCHES)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getWatch(id: string) {
    return this.one<Watch>(WATCHES, id);
  }

  async saveWatch(watch: Watch) {
    await this.command("HSET", WATCHES, watch.id, JSON.stringify(watch));
    return watch;
  }

  async removeWatch(id: string) {
    return (await this.command<number>("HDEL", WATCHES, id)) > 0;
  }

  async getCache(key: string) {
    const raw = await this.command<string | null>("GET", `tw:cache:${key}`);
    return raw ? (JSON.parse(raw) as { value: string; savedAt: number }) : null;
  }

  async setCache(key: string, value: string) {
    await this.command("SET", `tw:cache:${key}`, JSON.stringify({ value, savedAt: Date.now() }));
  }
}
