import type { KeyName } from "../config.ts";

/**
 * "Are my keys working?" for the Setup page. SerpApi's account endpoint is
 * free (it doesn't use a search) and reports how many searches are left this
 * month. Hotels.com has no free equivalent, so it runs one place lookup,
 * which uses 1 RapidAPI request.
 */

export interface ConnectionStatus {
  name: string;
  configured: boolean;
  ok: boolean;
  detail: string;
}

export async function checkConnections(keys: Record<KeyName, string>, fetchImpl: typeof fetch = fetch): Promise<ConnectionStatus[]> {
  return Promise.all([checkSerpApi(keys.SERPAPI_API_KEY, fetchImpl), checkHotelsCom(keys.RAPIDAPI_KEY, fetchImpl)]);
}

async function checkSerpApi(key: string, fetchImpl: typeof fetch): Promise<ConnectionStatus> {
  const name = "SerpApi (Google Flights)";
  if (!key) return { name, configured: false, ok: false, detail: "SERPAPI_API_KEY isn't set" };
  try {
    const res = await fetchImpl(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15_000) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; plan_name?: string; searches_per_month?: number; plan_searches_left?: number; this_month_usage?: number };
    if (!res.ok || data.error) return { name, configured: true, ok: false, detail: data.error ?? `HTTP ${res.status}` };
    const left = data.plan_searches_left ?? (data.searches_per_month !== undefined && data.this_month_usage !== undefined ? data.searches_per_month - data.this_month_usage : undefined);
    return { name, configured: true, ok: true, detail: `${data.plan_name ?? "Plan"}: ${left ?? "?"} of ${data.searches_per_month ?? "?"} searches left this month` };
  } catch (err) {
    return { name, configured: true, ok: false, detail: (err as Error).message };
  }
}

async function checkHotelsCom(key: string, fetchImpl: typeof fetch): Promise<ConnectionStatus> {
  const name = "Hotels.com (RapidAPI)";
  if (!key) return { name, configured: false, ok: false, detail: "RAPIDAPI_KEY isn't set" };
  const host = "hotels-com-provider.p.rapidapi.com";
  try {
    const res = await fetchImpl(`https://${host}/v2/regions?query=New%20York&domain=US&locale=en_US`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; data?: unknown[] };
    // RapidAPI says what's wrong in "message", e.g. "You are not subscribed to this API."
    if (!res.ok) return { name, configured: true, ok: false, detail: data.message ?? `HTTP ${res.status}` };
    if (!Array.isArray(data.data)) return { name, configured: true, ok: false, detail: "Connected, but the response wasn't in the expected format" };
    const left = res.headers.get("x-ratelimit-requests-remaining");
    const limit = res.headers.get("x-ratelimit-requests-limit");
    return { name, configured: true, ok: true, detail: `Working${left && limit ? `: ${left} of ${limit} requests left this period` : ""}` };
  } catch (err) {
    return { name, configured: true, ok: false, detail: (err as Error).message };
  }
}
