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
function steps(serpapiLive: boolean): Step[] {
  return [
    {
      step: "Get a SerpApi key",
      unlocks: "Real flight and hotel results, prices and price watch",
      source: "SerpApi (Google Flights + Google Hotels)",
      url: "https://serpapi.com/users/sign_up",
      cost: "Free plan: 250 searches a month",
      howTo: "Sign up, copy the key from your dashboard, set SERPAPI_API_KEY in .env (or in Vercel's environment variables), restart.",
      status: serpapiLive ? "done" : "todo",
    },
    {
      step: "Check flights and stays against the live service",
      unlocks: "Confidence the results are mapped correctly",
      source: "SerpApi",
      cost: "A few searches from the free plan",
      howTo: "Run one flight and one hotel search for a real trip, and compare the prices with Google Flights and Google Hotels.",
      status: "todo",
    },
    {
      step: "Plan your search budget",
      unlocks: "Not running out of free searches mid-month",
      source: "SerpApi",
      cost: "Free",
      howTo: "Each search uses 1 of the 250. Each watched price uses about 30 a month (one check a day), so keep it to a handful of watches.",
      status: "todo",
    },
    {
      step: "Put the site online",
      unlocks: "trips.jascui.com with login, storage and the daily price check",
      source: "Vercel Hobby + Upstash Redis",
      url: "https://vercel.com/signup",
      cost: "Free plans",
      howTo: "Follow \"Put it online\" in the README: import the repo, add Upstash storage, set APP_PASSWORD and CRON_SECRET, add the domain.",
      status: "todo",
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
      unlocks: "Edit hotels at your destination",
      source: "edithotelsearch.com",
      cost: "Free, no key",
      howTo: "Already connected. Nothing to do.",
      status: "done",
    },
  ];
}

export function Setup() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders([]));
  }, []);
  const serpapiLive = providers.some((p) => p.category === "flights" && p.live);

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
            {steps(serpapiLive).map((s, i) => (
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
