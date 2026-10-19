# Trip Workshop

One place to plan and book a trip. You search flights, stays, activities, rental cars and restaurants side by side, save the options you like to a trip board, compare them, then book and track everything on a day-by-day itinerary and budget.

> **Prototype status:** every search category runs on a built-in **mock provider** for now, so the app works fully without API keys. Prices and availability are made up but realistic, and they stay the same for the same search. **Book** opens the real site (Google Flights, Booking.com, GetYourGuide, Kayak, Google Maps) pre-filled with your search. After you book there, you record the confirmation number back in the app.

## Quick start

```bash
npm install
npm run dev        # API on :8787 + web app on http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | API + provider tests (Vitest + Supertest) |
| `npm run typecheck` | TypeScript across server, client and shared code |
| `npm run build && npm start` | Production build served from one port (8787) |

Trips are saved to `data/trips.json`, which is gitignored. Delete that file to start over.

## Install on your Mac (Dock app)

You do this once. You need [Node.js](https://nodejs.org) 20 or newer (`brew install node` works too).

```bash
git clone https://github.com/JasonCui1504/trip_planning.git ~/trip_planning
cd ~/trip_planning
git checkout claude/sleepy-rubin-8lyycm   # until this branch is merged
npm run mac:install
```

The script installs and builds the app. It also registers a background server that starts at login and restarts if it crashes, so Price watch keeps checking prices daily. When it's done, it opens http://localhost:8787. Then add it to the Dock:

- **Safari:** with the app open, **File → Add to Dock…**
- **Chrome:** click the install icon in the address bar, or **⋮ → Cast, save, and share → Install page as app…**. Then right-click its Dock icon and choose **Options → Keep in Dock**.

It opens in its own window with the Trip Workshop icon.

- **Updating:** run `git pull && npm run mac:install`.
- **Removing:** run `npm run mac:uninstall`, then drag the icon out of the Dock. Your trips stay in `data/`.
- **Logs:** `~/Library/Logs/TripWorkshop/server.log`

## Put it online at trips.jascui.com (free)

The app deploys to [Vercel](https://vercel.com)'s free Hobby plan, with a free [Upstash Redis](https://upstash.com) database for storage:

- **Website and server:** Vercel runs the API as a serverless function.
- **Storage:** Upstash Redis, because Vercel doesn't keep files between requests.
- **Daily price check:** a Vercel Cron job. The free plan allows one run a day, which is all Price watch needs.
- **Login:** a password (`APP_PASSWORD`), so only you can see your trips or use your API credits.

You do this once:

1. **Import the repo.** In Vercel: **Add New → Project → Import `JasonCui1504/trip_planning`**. Leave the framework settings alone, since `vercel.json` sets the build, then click **Deploy**. The first deploy will show "Storage isn't set up"; that's expected.
2. **Add storage.** In the project, open **Storage → Create → Upstash (Redis) → Free plan**, then **Connect** it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Set environment variables** under **Settings → Environment Variables**:
   - `APP_PASSWORD`: the password you'll log in with (required)
   - `CRON_SECRET`: any long random string (run `openssl rand -hex 32` in Terminal to make one)
   - `APP_TIMEZONE`: e.g. `America/Los_Angeles`
   - `SERPAPI_API_KEY`: optional, turns on live Google Flights and Hotels prices
4. **Redeploy.** Go to **Deployments → ⋯ → Redeploy**, then open the `*.vercel.app` link and log in.
5. **Add your domain.** In **Settings → Domains**, add `trips.jascui.com`. Vercel shows one DNS record to create where jascui.com's DNS lives, normally a **CNAME** named `trips` pointing to `cname.vercel-dns.com`. If jascui.com's DNS is already on Vercel, this happens automatically. HTTPS is set up for you.

From then on, every push to the repo redeploys the site automatically. The daily price check runs at about 14:00 UTC (7am Pacific); change the time under `crons` in `vercel.json`.

Data you have on your Mac (`data/trips.json`) doesn't move online automatically. Ask if you want an import button.

## What's in the app

- **Trips:** destination, dates, travelers and budget. Every search form is pre-filled from these.
- **Search & save:** tabs for Flights, Stays, Activities, Cars and Dining. You can sort results, filter them by tag and max price, and open details for each one. You can also tick up to 4 results and **compare** them in a side-by-side table.
- **Workshop:** build *scenarios*, i.e. different combinations of saved flights, cars, stays and activities plus drives, and compare their total cost, cost per person, time in the air, time on the road and estimated fuel side by side. **Suggest transfers** walks each scenario in time order (land, pick up the car, check in, activities, return flight) and adds the missing drives using real road routing. The map shows the flight arcs and the actual driving routes, with "On the ground" and "Whole trip" views.
- **Price watch:** press **Watch price** on any flight, stay or car. The server re-checks each watched option once a day (and on demand), keeps a daily price history, and the dashboard shows the current price, change since the last check, change since you started watching, the low and high, and a chart with a table view.
- **More booking sites:** every flight, stay and car links to the same search on other sites (Kayak, Skyscanner, Expedia, Hotels.com, Google Hotels, Airbnb, Rentalcars) for comparison shopping.
- **Trip board:** a panel that stays next to the search results and holds everything you've saved, grouped as *Idea → Shortlisted → Booked*. **Add your own** records things booked elsewhere (trains, tickets, reservations).
- **Book flow:** **Book** opens the provider in a new tab. A dialog then asks for the confirmation number and the final price, and marks the item as booked.
- **Itinerary:** one card per day showing check-ins and check-outs, flights (including the return leg), activities and dinners, plus which hotel you sleep at each night. Items with no date sit in an Unscheduled list until you assign them a day.
- **Budget:** booked vs. shortlisted vs. budget, the amount left per day, and a breakdown by category.
- **Checklist & notes:** a starter pre-trip checklist and notes that save automatically.

## Project layout

```
shared/types.ts            Data model shared by server and client (Trip, TripItem, Offer, search params)
server/
  index.ts                 Starts the API; serves dist/ in production
  app.ts                   Express routes (/api/search/:category, /api/trips, items)
  validate.ts              Request validation
  db.ts                    Store interface + JSON-file store (local)
  redis.ts                 Upstash Redis store (hosted)
  auth.ts                  Password login (on when APP_PASSWORD is set)
  vercel.ts                Vercel entry point (bundled to build/server.mjs; served by api/index.js)
  edit.ts                  Chase Edit hotel list (fetched from edithotelsearch.com, cached weekly)
  maps.ts                  Geocoding (OpenStreetMap Nominatim) + driving routes (OSRM, or Google with a key)
  watch.ts                 Daily price-watch job
  config.ts                Env vars / API keys
  providers/
    index.ts               Provider registry: uses a live provider when its keys are set, otherwise the mock
    serpapi.ts             Live Google Flights / Google Hotels via SerpApi
    links.ts               Deep links into real booking sites (+ the same search on other sites)
    mock/                  Mock flights, stays, activities, cars, dining + 36-city place data
src/                       React app (Vite)
  components/              Home, Workspace, SearchPanel, TripBoard, Itinerary, Budget, Checklist, …
tests/                     API tests
```

## Real prices

All the real-price features run through one key, `SERPAPI_API_KEY`, from [SerpApi](https://serpapi.com). Its free tier has a few hundred searches a month; paid plans start around $25/month. Put the key in `.env`, restart, and the Flights and Stays tabs switch to live data. The header badge shows which categories are live.

| What | Where it comes from |
| --- | --- |
| Flights | **Google Flights** results and prices, plus Google's "prices are low/typical/high" insight |
| Hotels | **Google Hotels**: nightly and total price, rating, photos, map location, and the **price on each booking site** Google lists (often Hotels.com, Expedia, Booking.com and the hotel's own site) |
| Price watch | The same live searches, re-run once a day (one search per watched item per day) |

The adapters (`server/providers/serpapi.ts`) follow SerpApi's documented response format and are tested against sample responses in that format. They haven't been run against the live service yet, since there's no key in this repo.

Not used:

- **Amadeus Self-Service:** shut down in July 2026, so it's no longer an option for new apps.
- **Scraping Hotels.com directly:** against its terms and blocked by bot protection. Google Hotels already reports the Hotels.com price for most properties.
- **Bookable rates:** if you later want booking inside the app, the candidates are [LiteAPI](https://liteapi.travel) for hotels (free sandbox) and [Duffel](https://duffel.com) for flights.

To add another provider, implement `SearchProvider` (see `server/providers/index.ts`), map its response into the shared `Offer` shape, and add it to `liveProviders`. A provider is used once all of its `requiredKeys` are set; otherwise its category falls back to mock data.

## Chase "The Edit" hotels

The Stays tab lists the Chase Sapphire Reserve Edit hotels at your destination. The list comes from [edithotelsearch.com](https://edithotelsearch.com/), a community site that isn't affiliated with Chase. Its brand list flags the hotels that also get the 2026 $250 Select Hotels credit. Live hotel results that are in the Edit collection get a **Chase Edit** badge.

The server fetches the list on first use and caches it for a week (in `data/` locally, or in Redis when hosted). If the site can't be reached, the cached copy is used. Always confirm on Chase Travel before booking.

## Maps & driving times

Driving times use real road routing out of the box, with no key needed:

- **Routing:** the public [OSRM](https://project-osrm.org/) server, running on OpenStreetMap data.
- **Place search:** [Nominatim](https://nominatim.org/), rate-limited to its policy of one request per second, with cached results.
- **Map tiles:** OpenStreetMap.

To use Google Maps for routing instead, set `GOOGLE_MAPS_API_KEY` (Routes API). With `MAPS_OFFLINE=1`, or if those services can't be reached, the app falls back to a straight-line estimate and labels it "Estimate". The public OSRM and Nominatim servers are fine for personal use but not for heavy traffic; for production, host your own or use a paid provider.

## Known prototype limits

- Single user. Login is one shared password, not separate accounts.
- Mock flight times ignore time zones.
- Price watch only runs while the server is running. It catches up on its next start, but missed days aren't backfilled.
- Drive legs are priced as fuel only. Tolls, parking and taxis/trains aren't modelled yet.
- All prices are in USD.
- Booking happens on the provider's site. The app records the result but doesn't take payment.
