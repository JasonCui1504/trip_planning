import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Single-user password login for when the app is on the public internet.
 * Turned on by setting APP_PASSWORD; with it unset (e.g. on your own Mac)
 * everything stays open.
 *
 * A successful login sets an HttpOnly cookie holding an expiry time signed
 * with SESSION_SECRET (or, if that's unset, a key derived from the password,
 * so changing the password logs every session out).
 */

const COOKIE = "tw_session";
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

export interface AuthOptions {
  password?: string;
  secret?: string;
  now?: () => number;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export function createAuth({ password, secret, now = Date.now }: AuthOptions) {
  const enabled = Boolean(password);
  const key = secret || (password ? sha256(`trip-workshop:${password}`).toString("hex") : "");
  const sign = (payload: string) => createHmac("sha256", key).update(payload).digest("base64url");
  const attempts = new Map<string, { count: number; since: number }>();

  function sessionValid(req: Request): boolean {
    if (!enabled) return true;
    const raw = parseCookies(req.headers.cookie)[COOKIE];
    if (!raw) return false;
    const [exp, sig] = raw.split(".");
    if (!exp || !sig) return false;
    const expected = sign(exp);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    return Number(exp) > now();
  }

  function checkPassword(attempt: unknown): boolean {
    if (!enabled || typeof attempt !== "string") return false;
    // Compare fixed-length digests so timing doesn't leak the length.
    return timingSafeEqual(sha256(attempt), sha256(password!));
  }

  function cookie(req: Request, value: string, maxAgeSeconds: number) {
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
  }

  return {
    enabled,

    session(req: Request, res: Response) {
      res.json({ authRequired: enabled, authenticated: sessionValid(req) });
    },

    login(req: Request, res: Response) {
      if (!enabled) return void res.json({ ok: true });
      const ip = req.ip ?? "unknown";
      const entry = attempts.get(ip);
      if (entry && now() - entry.since < ATTEMPT_WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
        return void res.status(429).json({ error: "Too many attempts — try again in a few minutes." });
      }
      if (!checkPassword(req.body?.password)) {
        const fresh = !entry || now() - entry.since >= ATTEMPT_WINDOW_MS;
        attempts.set(ip, { count: fresh ? 1 : entry.count + 1, since: fresh ? now() : entry.since });
        return void res.status(401).json({ error: "Wrong password." });
      }
      attempts.delete(ip);
      const exp = String(now() + SESSION_DAYS * 86_400_000);
      res.setHeader("Set-Cookie", cookie(req, `${exp}.${sign(exp)}`, SESSION_DAYS * 86_400));
      res.json({ ok: true });
    },

    logout(req: Request, res: Response) {
      res.setHeader("Set-Cookie", cookie(req, "", 0));
      res.json({ ok: true });
    },

    /** Blocks API calls without a valid session. */
    require(req: Request, res: Response, next: NextFunction) {
      if (sessionValid(req)) return next();
      res.status(401).json({ error: "Please log in." });
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
