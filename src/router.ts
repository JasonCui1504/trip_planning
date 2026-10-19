import { useEffect, useState } from "react";

export type WorkspaceTab = "search" | "workshop" | "itinerary" | "budget" | "checklist";

export type Route = { page: "home" } | { page: "watch" } | { page: "setup" } | { page: "trip"; id: string; tab: WorkspaceTab };

const TABS: WorkspaceTab[] = ["search", "workshop", "itinerary", "budget", "checklist"];

function parse(hash: string): Route {
  const [, page, id, tab] = hash.replace(/^#/, "").split("/");
  if (page === "watch") return { page: "watch" };
  if (page === "setup") return { page: "setup" };
  if (page === "trip" && id) return { page: "trip", id, tab: TABS.includes(tab as WorkspaceTab) ? (tab as WorkspaceTab) : "search" };
  return { page: "home" };
}

export function href(route: Route): string {
  if (route.page === "home") return "#/";
  if (route.page === "watch") return "#/watch";
  if (route.page === "setup") return "#/setup";
  return `#/trip/${route.id}/${route.tab}`;
}

export function navigate(route: Route) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
