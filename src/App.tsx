import { useEffect, useState } from "react";
import type { ProviderStatus } from "../shared/types.ts";
import { api, UNAUTHORIZED_EVENT, USAGE_EVENT, type SerpApiUsage } from "./api.ts";
import { Login } from "./components/Login.tsx";
import { Home } from "./components/Home.tsx";
import { PriceWatch } from "./components/PriceWatch.tsx";
import { Prices } from "./components/Prices.tsx";
import { Setup } from "./components/Setup.tsx";
import { Workspace } from "./components/Workspace.tsx";
import { Icon } from "./icons.tsx";
import { href, useRoute } from "./router.ts";

export function App() {
  const route = useRoute();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [auth, setAuth] = useState<{ authRequired: boolean; authenticated: boolean } | null>(null);

  useEffect(() => {
    api.session().then(setAuth).catch(() => setAuth({ authRequired: false, authenticated: true }));
    const onUnauthorized = () => setAuth({ authRequired: true, authenticated: false });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signedIn = auth?.authenticated ?? false;
  useEffect(() => {
    if (signedIn) api.providers().then(setProviders).catch(() => setProviders([]));
  }, [signedIn]);

  const [usage, setUsage] = useState<SerpApiUsage | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const load = () => api.usage().then(setUsage).catch(() => setUsage(null));
    load();
    window.addEventListener(USAGE_EVENT, load);
    return () => window.removeEventListener(USAGE_EVENT, load);
  }, [signedIn]);

  if (!auth) return <div className="app" />;
  if (!auth.authenticated) return <Login onSuccess={() => setAuth({ authRequired: true, authenticated: true })} />;

  const liveCount = providers.filter((p) => p.live).length;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href({ page: "home" })}>
          <span className="brand-mark">
            <Icon name="plane" size={16} />
          </span>
          <span className="brand-text">Trip Workshop</span>
        </a>
        <nav className="topnav">
          <a className={`topnav-link ${route.page === "prices" ? "active" : ""}`} href={href({ page: "prices" })}>
            Prices
          </a>
          <a className={`topnav-link ${route.page === "home" || route.page === "trip" ? "active" : ""}`} href={href({ page: "home" })}>
            Trips
          </a>
          <a className={`topnav-link ${route.page === "watch" ? "active" : ""}`} href={href({ page: "watch" })}>
            Price watch
          </a>
          <a className={`topnav-link ${route.page === "setup" ? "active" : ""}`} href={href({ page: "setup" })}>
            Setup
          </a>
        </nav>
        {providers.length > 0 && (
          <span
            className={`pill ${liveCount ? "pill-live" : "pill-off"}`}
            title={providers.map((p) => `${p.category}: ${p.provider}${p.live ? " (live)" : ""}`).join("\n")}
          >
            {liveCount ? `${liveCount}/${providers.length} categories live` : "No live data connected"}
          </span>
        )}
        {usage?.configured && <UsageCounter usage={usage} />}
        {auth.authRequired && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await api.logout();
              setAuth({ authRequired: true, authenticated: false });
            }}
          >
            Log out
          </button>
        )}
      </header>
      <main className="main">
        {route.page === "trip" ? <Workspace key={route.id} id={route.id} tab={route.tab} /> : route.page === "watch" ? <PriceWatch /> : route.page === "setup" ? <Setup /> : route.page === "prices" ? <Prices id={route.id} /> : <Home />}
      </main>
    </div>
  );
}

/** SerpApi searches left this month (each flight search, and each date on a flight grid, uses one). */
function UsageCounter({ usage }: { usage: SerpApiUsage }) {
  if (usage.error || usage.left === undefined)
    return (
      <span className="usage-counter usage-low" title={usage.error ?? "SerpApi didn't say how many searches are left"}>
        <span className="usage-suffix">Flight searches: </span>?
      </span>
    );
  const low = usage.limit ? usage.left / usage.limit < 0.15 : usage.left < 30;
  return (
    <span className={`usage-counter ${low ? "usage-low" : ""}`} title={`SerpApi${usage.plan ? ` (${usage.plan})` : ""}: flight searches left this month. Each date on a flight grid uses one.`}>
      <strong>{usage.left.toLocaleString()}</strong>
      {usage.limit ? ` / ${usage.limit.toLocaleString()}` : ""}
      <span className="usage-suffix"> searches left</span>
    </span>
  );
}
