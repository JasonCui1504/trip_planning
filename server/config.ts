import "dotenv/config";

const env = (key: string) => process.env[key]?.trim() ?? "";

export const config = {
  port: Number(env("PORT") || 8787),
  dataFile: env("DATA_FILE") || "data/trips.json",
  keys: {
    AMADEUS_CLIENT_ID: env("AMADEUS_CLIENT_ID"),
    AMADEUS_CLIENT_SECRET: env("AMADEUS_CLIENT_SECRET"),
    DUFFEL_API_KEY: env("DUFFEL_API_KEY"),
    BOOKING_AFFILIATE_ID: env("BOOKING_AFFILIATE_ID"),
    GETYOURGUIDE_API_KEY: env("GETYOURGUIDE_API_KEY"),
    RENTALCARS_API_KEY: env("RENTALCARS_API_KEY"),
    YELP_API_KEY: env("YELP_API_KEY"),
  },
};

export type KeyName = keyof typeof config.keys;
