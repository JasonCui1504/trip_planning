# Trip Workshop

One place to plan and book a trip. You search flights, stays, activities, rental cars and restaurants side by side, save the options you like to a trip board, compare them, then book and track everything on a day-by-day itinerary and budget.

> **Real data only:** the app never shows made-up results. Flights show live Google Flights results once `SERPAPI_API_KEY` is set, and stays show live Hotels.com results once `RAPIDAPI_KEY` is set. Activities, cars and dining have no live source yet, so their tabs show no results, only buttons that run the same search on real sites (Kayak, Expedia, GetYourGuide, Viator, Google Maps, OpenTable…). After you book anywhere, record it on the trip board with **Add your own**. The **Setup** page in the app lists what's left to connect; the same list is under [Next steps](#next-steps) below.

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
   - `SERPAPI_API_KEY`: optional, turns on live Google Flights prices
   - `RAPIDAPI_KEY`: optional, turns on live Hotels.com prices
   - `TRAVEL_BUDGET_USERNAME` / `TRAVEL_BUDGET_PASSWORD`: optional, your jascui.com travel budget login for **Export to travel budget** (otherwise you type it in the export dialog)
4. **Redeploy.** Go to **Deployments → ⋯ → Redeploy**, then open the `*.vercel.app` link and log in.
5. **Add your domain.** In **Settings → Domains**, add `trips.jascui.com`. Vercel shows one DNS record to create where jascui.com's DNS lives, normally a **CNAME** named `trips` pointing to `cname.vercel-dns.com`. If jascui.com's DNS is already on Vercel, this happens automatically. HTTPS is set up for you.

From then on, every push to the repo redeploys the site automatically. The daily price check runs at about 14:00 UTC (7am Pacific); change the time under `crons` in `vercel.json`.

Data you have on your Mac (`data/trips.json`) doesn't move online automatically. Ask if you want an import button.

## What's in the app

- **Prices (the dashboard):** set up a *grid* once and compare every combination's cheapest price in one table, instead of opening a tab per search.
  - **Flight grids:** several departure airports × several arrival airports × several dates, e.g. BWI and DCA to SFO and SJC on four dates is 16 cells. Each cell shows the cheapest fare, the cheapest nonstop, the change since the last check, and Google Flights' "low / typical / high" read. Click a cell for the flights (with Google Flights links), your own price history, and Google's price history for that route.
  - **Hotel grids:** several places (cities or neighbourhoods) × several check-in dates on Hotels.com. Each cell shows the cheapest stay, the typical (median) price there, and the cheapest Chase Edit hotel; click for the options with Hotels.com links.
  - **Tracking:** a grid can re-check itself every day, 2 days, 3 days or week (the daily cron job; up to ~45 seconds of searches a run, with the rest picked up next time), or only when you press **Check prices**. The form shows how many searches a check costs and roughly how many a month tracking will use. Grids are capped at 40 searches per check.

- **Trips:** destination, dates, travelers and budget. Every search form is pre-filled from these.
- **Search & save:** tabs for Flights, Stays, Activities, Cars and Dining. Categories with a live source show results you can sort, filter by tag and max price, and open for details; you can also tick up to 4 results and **compare** them side by side. Categories without one link out to the same search on real sites.
- **Workshop:** build *scenarios*, i.e. different combinations of saved flights, cars, stays and activities plus drives, and compare their total cost, cost per person, time in the air, time on the road and estimated fuel side by side. **Suggest transfers** walks each scenario in time order (land, pick up the car, check in, activities, return flight) and adds the missing drives using real road routing. The map shows the flight arcs and the actual driving routes, with "On the ground" and "Whole trip" views.
- **Price watch:** press **Watch price** on any live flight or stay. The server re-checks each watched option once a day (and on demand), keeps a daily price history, and the dashboard shows the current price, change since the last check, change since you started watching, the low and high, and a chart with a table view.
- **More booking sites:** every flight and stay links to the same search on other sites (Kayak, Skyscanner, Expedia, Hotels.com, Google Hotels, Airbnb) for comparison shopping.
- **Export to travel budget:** sends a trip to [jascui.com/travel_budget](https://www.jascui.com/travel_budget). See [below](#export-to-the-travel-budget).
- **Setup:** a table of the steps left to connect real data, with the free API for each and whether it's done.
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
  places.ts                36 common destinations: airport code + coordinates, city centre (autocomplete, offline geocoding)
  watch.ts                 Daily price-watch job
  travelBudget.ts          Export a trip to jascui.com/travel_budget through its API
  config.ts                Env vars / API keys
  providers/
    index.ts               Provider registry: uses a live provider when its keys are set, otherwise returns no results
    serpapi.ts             Live Google Flights via SerpApi
    hotelscom.ts           Live Hotels.com stays via the Hotels.com Provider API (RapidAPI)
    links.ts               Deep links into real booking sites (+ the same search on other sites)
src/                       React app (Vite)
  components/              Home, Workspace, SearchPanel, TripBoard, Itinerary, Budget, Checklist, Setup, …
tests/                     API tests
```

## Real prices

Each category with real data has its own source:

| What | Where it comes from | Key |
| --- | --- | --- |
| Flights | **Google Flights** via [SerpApi](https://serpapi.com): results, prices, and Google's "prices are low/typical/high" insight. SerpApi is used for flights only. | `SERPAPI_API_KEY` (free plan: 250 searches a month) |
| Stays | **Hotels.com** via the [Hotels.com Provider API](https://rapidapi.com/tipsters/api/hotels-com-provider) on RapidAPI: nightly and total price, guest score, photo, map location, and a link straight to the hotel on Hotels.com | `RAPIDAPI_KEY` (free Basic plan) |
| Chase Edit | [edithotelsearch.com](https://edithotelsearch.com/): the Edit hotel list for your destination, and a **Chase Edit** badge on Hotels.com results that are in it | None |
| Price watch | The same live searches, re-run once a day | (uses the keys above) |

How it fits together: `server/providers/index.ts` picks the provider for each category (`serpapiFlights` for flights, `hotelsComHotels` for stays) once its key is set. Every provider maps its response into the shared `Offer` shape, and hotel results then go through the Chase Edit list to get their badges. The Stays tab also lists the Edit hotels at your destination; **Check price** on one runs a Hotels.com search for that hotel by name and puts it first.

A Hotels.com search is two requests: one to turn the destination into a Hotels.com region (cached), then the search itself. Hotels.com's official API (Expedia Rapid) is partner-only with an approval process, which is why this goes through RapidAPI.

Both adapters (`serpapi.ts`, `hotelscom.ts`) follow their APIs' documented response formats and are tested against sample responses in that format. They haven't been run against the live services yet, since there are no keys in this repo.

Not used:

- **Google Hotels (SerpApi):** replaced by Hotels.com, so SerpApi's searches all go to flights.
- **Amadeus Self-Service:** shut down in July 2026, so it's no longer an option for new apps.
- **Scraping Hotels.com directly:** against its terms and blocked by bot protection.
- **Bookable rates:** if you later want booking inside the app, the candidates are [LiteAPI](https://liteapi.travel) for hotels (free sandbox) and [Duffel](https://duffel.com) for flights.

## Export to the travel budget

On any trip, **Export to travel budget** sends it to [jascui.com/travel_budget](https://www.jascui.com/travel_budget). It signs in with your travel budget username and password and uses that site's own API, so nothing on the photography site had to change. Type the login in the dialog (used once, never stored), or save it as `TRAVEL_BUDGET_USERNAME` / `TRAVEL_BUDGET_PASSWORD`.

| Trip Workshop | Travel budget |
| --- | --- |
| Trip name and dates | A trip with the same name. The dates widen to cover anything just outside them, like a return flight the day after. |
| Dated flights | Calendar events marked **transit**, from departure to arrival (an overnight flight runs to midnight). A return flight gets its own event at its departure time. |
| Dated activities, dinners, custom items | Calendar events, **booked** or **not booked**, in half hours. Items without an end time get a default length (activities 3h, dinners 1.5h). |
| Stays | Each night's accommodation, with link and address; booked stays are marked **Confirmed**. |
| Rental cars | Each day's car; booked ones are marked **Confirmed**. |
| Ideas, and items without a date | The trip's Ideas list. |
| Bookings, totals, notes | The trip's doc, written on the first export only. |

Booked stays and cars win a day over shortlisted ones. Each event's notes carry the confirmation number, cost and provider.

Exporting again updates the same trip: it removes the events and ideas the last export added, clears the stay/car fields of days it no longer covers, and writes the current plan. Anything you added on the travel budget yourself stays. If you deleted the trip there, the next export creates a new one.

To add another provider, implement `SearchProvider` (see `server/providers/index.ts`), map its response into the shared `Offer` shape, and add it to `liveProviders`. A provider is used once all of its `requiredKeys` are set; otherwise its category shows no results, only links to real sites.

## Next steps

Everything below is free. The app's **Setup** page shows the same table.

| # | Step | What it unlocks | API / service | Cost | How | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Get a SerpApi key | Real Google Flights results, prices and price watch | [SerpApi](https://serpapi.com/users/sign_up) (flights only) | Free plan: 250 searches a month | Sign up, copy the key, set `SERPAPI_API_KEY` in Vercel's environment variables (or `.env`), redeploy | To do |
| 2 | Get a RapidAPI key for Hotels.com | Real Hotels.com stays, Chase Edit badges on them, hotel price watch | [Hotels.com Provider API](https://rapidapi.com/tipsters/api/hotels-com-provider/pricing) on RapidAPI | Free Basic plan (check the monthly limit on its pricing tab) | Make a RapidAPI account, subscribe to Basic, set `RAPIDAPI_KEY` to your X-RapidAPI-Key, redeploy | To do |
| 3 | Check flights and stays against the live services | Confidence the results are mapped correctly | SerpApi, Hotels.com Provider | A few searches from the free plans | Run one flight and one hotel search for a real trip and compare with Google Flights and Hotels.com | To do |
| 4 | Save your travel budget login (optional) | Export without typing the password each time | jascui.com travel budget | Free | Set `TRAVEL_BUDGET_USERNAME` and `TRAVEL_BUDGET_PASSWORD`, or type them in the Export dialog | To do |
| 5 | Plan your search budget | Not running out of free searches mid-month | SerpApi, RapidAPI | Free | A flight search uses 1 SerpApi search, a hotel search 2 RapidAPI requests. Each watched price is checked daily, so keep it to a handful of watches | To do |
| 6 | Put the site online | trips.jascui.com | Vercel Hobby + Upstash Redis | Free plans | Already online | Done |
| 7 | Connect activities | Real tours and attractions with prices | [Viator Partner API](https://partnerresources.viator.com/travel-commerce/affiliate/) (Basic Access) | Free: join the affiliate program; Basic Access needs no approval | Get the API key, then build `server/providers/viator.ts` and register it for `activities` | To do |
| 8 | Connect restaurants | Real restaurants near your stay, filterable by cuisine (no prices or ratings) | [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Free, no key | Build `server/providers/overpass.ts` that queries `amenity=restaurant` around the destination and register it for `dining` | To do |
| 9 | Car rentals | Real rental prices | None found that is free | Rental price APIs are paid or partner-only | Keep using the Kayak, Expedia and Rentalcars links on the Cars tab, then record the booking with **Add your own** | No free option |
| 10 | Maps and driving times | Road routes, drive times, place search | OSRM + Nominatim + OpenStreetMap tiles | Free, no key | Already connected | Done |
| 11 | Chase Edit hotel list | Edit hotels at your destination, and badges on Hotels.com results | edithotelsearch.com | Free, no key | Already connected | Done |

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
- Price watch only runs while the server is running. It catches up on its next start, but missed days aren't backfilled.
- Drive legs are priced as fuel only. Tolls, parking and taxis/trains aren't modelled yet.
- All prices are in USD.
- Booking happens on the provider's site. The app records the result but doesn't take payment.
