import { useEffect, useState } from "react";
import type { ProviderStatus } from "../shared/types.ts";
import { api, UNAUTHORIZED_EVENT } from "./api.ts";
import { Login } from "./components/Login.tsx";
import { Home } from "./components/Home.tsx";
import { PriceWatch } from "./components/PriceWatch.tsx";
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
          Trip Workshop
        </a>
        <nav className="topnav">
          <a className={`topnav-link ${route.page !== "watch" ? "active" : ""}`} href={href({ page: "home" })}>
            Trips
          </a>
          <a className={`topnav-link ${route.page === "watch" ? "active" : ""}`} href={href({ page: "watch" })}>
            Price watch
          </a>
        </nav>
        {providers.length > 0 && (
          <span
            className={`pill ${liveCount ? "pill-live" : "pill-sample"}`}
            title={providers.map((p) => `${p.category}: ${p.provider}${p.live ? " (live)" : ""}`).join("\n")}
          >
            {liveCount ? `${liveCount}/${providers.length} live providers` : "Sample data mode"}
          </span>
        )}
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
        {route.page === "trip" ? <Workspace key={route.id} id={route.id} tab={route.tab} /> : route.page === "watch" ? <PriceWatch /> : <Home />}
      </main>
    </div>
  );
}
