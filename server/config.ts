import "dotenv/config";

const env = (key: string) => process.env[key]?.trim() ?? "";

export const config = {
  port: Number(env("PORT") || 8787),
  dataFile: env("DATA_FILE") || "data/trips.json",
  mapsOffline: env("MAPS_OFFLINE") === "1",
  googleMapsKey: env("GOOGLE_MAPS_API_KEY"),
  /** Set to require a password (needed when the app is on the internet). */
  appPassword: env("APP_PASSWORD"),
  sessionSecret: env("SESSION_SECRET"),
  cronSecret: env("CRON_SECRET"),
  /** How often the price watcher wakes up to check for stale watches. */
  watchIntervalMinutes: Number(env("WATCH_INTERVAL_MINUTES") || 60),
  /** jascui.com's travel budget, where trips can be exported. */
  travelBudget: {
    url: env("TRAVEL_BUDGET_URL") || "https://www.jascui.com",
    username: env("TRAVEL_BUDGET_USERNAME"),
    password: env("TRAVEL_BUDGET_PASSWORD"),
  },
  keys: {
    /** Google Flights, via SerpApi. */
    SERPAPI_API_KEY: env("SERPAPI_API_KEY"),
    /** Hotels.com, via the Hotels.com Provider API on RapidAPI. */
    RAPIDAPI_KEY: env("RAPIDAPI_KEY"),
  },
};

export type KeyName = keyof typeof config.keys;
