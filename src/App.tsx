import { useEffect, useState } from "react";
import type { ProviderStatus } from "../shared/types.ts";
import { api } from "./api.ts";
import { Home } from "./components/Home.tsx";
import { Workspace } from "./components/Workspace.tsx";
import { Icon } from "./icons.tsx";
import { href, useRoute } from "./router.ts";

export function App() {
  const route = useRoute();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders([]));
  }, []);

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
        {providers.length > 0 && (
          <span
            className={`pill ${liveCount ? "pill-live" : "pill-sample"}`}
            title={providers.map((p) => `${p.category}: ${p.provider}${p.live ? " (live)" : ""}`).join("\n")}
          >
            {liveCount ? `${liveCount}/${providers.length} live providers` : "Sample data mode"}
          </span>
        )}
      </header>
      <main className="main">{route.page === "trip" ? <Workspace key={route.id} id={route.id} tab={route.tab} /> : <Home />}</main>
    </div>
  );
}
