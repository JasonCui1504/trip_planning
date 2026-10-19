import { useEffect, useState } from "react";
import type { ProviderStatus } from "../../shared/types.ts";
import { api } from "../api.ts";

type StepStatus = "done" | "todo" | "skip";

interface Step {
  step: string;
  unlocks: string;
  source: string;
  url?: string;
  cost: string;
  howTo: string;
  status: StepStatus;
}

const STATUS_LABEL: Record<StepStatus, string> = { done: "Done", todo: "To do", skip: "No free option" };
const STATUS_CLASS: Record<StepStatus, string> = { done: "status-booked", todo: "status-shortlisted", skip: "status-idea" };

/**
 * What's left to connect, in order. Every source here is free; categories
 * with no free real-data source say so instead of showing made-up results.
 */
function steps({ flightsLive, hotelsLive, savedLogin }: { flightsLive: boolean; hotelsLive: boolean; savedLogin: boolean }): Step[] {
  return [
    {
      step: "Get a SerpApi key",
      unlocks: "Real flight results and prices from Google Flights, and flight price watch",
      source: "SerpApi (Google Flights only)",
      url: "https://serpapi.com/users/sign_up",
      cost: "Free plan: 250 searches a month",
      howTo: "Sign up, copy the key from your dashboard, set SERPAPI_API_KEY in Vercel's environment variables (or .env), redeploy.",
      status: flightsLive ? "done" : "todo",
    },
    {
      step: "Get a RapidAPI key for Hotels.com",
      unlocks: "Real Hotels.com stays and prices, Chase Edit badges on them, and hotel price watch",
      source: "Hotels.com Provider API on RapidAPI",
      url: "https://rapidapi.com/tipsters/api/hotels-com-provider/pricing",
      cost: "Free Basic plan (check the monthly limit on the pricing tab)",
      howTo: "Make a RapidAPI account, subscribe to the Basic plan, copy your X-RapidAPI-Key into RAPIDAPI_KEY, redeploy. Each hotel search uses 2 requests (place lookup + search).",
      status: hotelsLive ? "done" : "todo",
    },
    {
      step: "Check flights and stays against the live services",
      unlocks: "Confidence the results are mapped correctly",
      source: "SerpApi, Hotels.com Provider",
      cost: "A few searches from the free plans",
      howTo: "Run one flight and one hotel search for a real trip, and compare the prices with Google Flights and Hotels.com.",
      status: "todo",
    },
    {
      step: "Save your travel budget login (optional)",
      unlocks: "Export to jascui.com/travel_budget without typing the password each time",
      source: "jascui.com travel budget",
      url: "https://www.jascui.com/travel_budget",
      cost: "Free",
      howTo: "Set TRAVEL_BUDGET_USERNAME and TRAVEL_BUDGET_PASSWORD in Vercel's environment variables, or just type them in the Export dialog on a trip.",
      status: savedLogin ? "done" : "todo",
    },
    {
      step: "Plan your search budget",
      unlocks: "Not running out of free searches mid-month",
      source: "SerpApi, RapidAPI",
      cost: "Free",
      howTo: "Each watched price is checked once a day, about 30 searches a month (60 RapidAPI requests for a hotel), so keep it to a handful of watches.",
      status: "todo",
    },
    {
      step: "Put the site online",
      unlocks: "trips.jascui.com with login, storage and the daily price check",
      source: "Vercel Hobby + Upstash Redis",
      url: "https://vercel.com/signup",
      cost: "Free plans",
      howTo: "Already online.",
      status: "done",
    },
    {
      step: "Connect activities",
      unlocks: "Real tours and attractions with prices",
      source: "Viator Partner API (Basic Access)",
      url: "https://partnerresources.viator.com/travel-commerce/affiliate/",
      cost: "Free: join the affiliate program; Basic Access needs no approval",
      howTo: "Sign up as a Viator affiliate, get the API key, then build server/providers/viator.ts and register it for activities.",
      status: "todo",
    },
    {
      step: "Connect restaurants",
      unlocks: "Real restaurants near your stay, filterable by cuisine (no prices or ratings)",
      source: "OpenStreetMap Overpass API",
      url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
      cost: "Free, no key",
      howTo: "Build server/providers/overpass.ts that queries amenity=restaurant around the destination and register it for dining.",
      status: "todo",
    },
    {
      step: "Car rentals",
      unlocks: "Real rental prices",
      source: "None found that is free",
      cost: "Rental price APIs are paid or partner-only",
      howTo: "Keep using the Kayak, Expedia and Rentalcars links on the Cars tab, then record your booking with \"Add your own\" on the trip board.",
      status: "skip",
    },
    {
      step: "Maps and driving times",
      unlocks: "Road routes, drive times and place search",
      source: "OSRM + Nominatim + OpenStreetMap tiles",
      cost: "Free, no key",
      howTo: "Already connected. Nothing to do.",
      status: "done",
    },
    {
      step: "Chase Edit hotel list",
      unlocks: "Edit hotels at your destination, and Chase Edit badges on Hotels.com results",
      source: "edithotelsearch.com",
      cost: "Free, no key",
      howTo: "Already connected. Nothing to do.",
      status: "done",
    },
  ];
}

export function Setup() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [savedLogin, setSavedLogin] = useState(false);
  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders([]));
    api.travelBudget().then((t) => setSavedLogin(t.savedLogin)).catch(() => setSavedLogin(false));
  }, []);
  const live = (category: ProviderStatus["category"]) => providers.some((p) => p.category === category && p.live);

  return (
    <div className="home">
      <section>
        <span className="eyebrow">Setup</span>
        <h1>Next steps</h1>
        <p className="muted">
          The app only shows real data. A category without a connected source shows no results, just links to run the same search on real sites. These
          are the free sources to connect, in order.
        </p>
      </section>
      <div className="card table-scroll">
        <table className="compare-table setup-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Step</th>
              <th>What it unlocks</th>
              <th>API / service</th>
              <th>Cost</th>
              <th>How</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {steps({ flightsLive: live("flights"), hotelsLive: live("hotels"), savedLogin }).map((s, i) => (
              <tr key={s.step}>
                <td>{i + 1}</td>
                <td>{s.step}</td>
                <td>{s.unlocks}</td>
                <td>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.source}
                    </a>
                  ) : (
                    s.source
                  )}
                </td>
                <td>{s.cost}</td>
                <td className="muted">{s.howTo}</td>
                <td>
                  <span className={`status-chip ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
