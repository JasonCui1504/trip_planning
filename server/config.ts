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
  keys: {
    SERPAPI_API_KEY: env("SERPAPI_API_KEY"),
    DUFFEL_API_KEY: env("DUFFEL_API_KEY"),
    BOOKING_AFFILIATE_ID: env("BOOKING_AFFILIATE_ID"),
    GETYOURGUIDE_API_KEY: env("GETYOURGUIDE_API_KEY"),
    RENTALCARS_API_KEY: env("RENTALCARS_API_KEY"),
    YELP_API_KEY: env("YELP_API_KEY"),
  },
};

export type KeyName = keyof typeof config.keys;
