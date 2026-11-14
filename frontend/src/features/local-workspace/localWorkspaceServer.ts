import { cookieName, localOrigin, LocalSessionStore, sessionLifetime, sessionPath } from "./localSessionStore.ts";

const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const routes: Record<string, RegExp[]> = {
  GET: [new RegExp(`^/api/v1/repository(?:/snapshots/${uuid}(?:/files/${uuid})?)?$`),
    /^\/api\/v1\/agent\/config$/,
    new RegExp(`^/api/v1/agent/runs/${uuid}$`),
    new RegExp(`^/api/v1/changes/(?:config|proposals/${uuid}|tests/${uuid})$`)],
  POST: [/^\/api\/v1\/repository\/snapshots$/,
    /^\/api\/v1\/agent\/messages$/,
    /^\/api\/v1\/agent\/runs$/,
    new RegExp(`^/api/v1/agent/runs/${uuid}/cancel$`),
    new RegExp(`^/api/v1/changes/proposals(?:/${uuid}/(?:revisions|tests))?$`)],
};
const quotationRoutes: Record<string, RegExp[]> = {
  GET: [new RegExp(`^/api/v1/quotations(?:/${uuid})?$`)],
  POST: [new RegExp(`^/api/v1/quotations(?:/${uuid}/validate)?$`)],
};
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (status: number) => Response.json({ error: { code: "LOCAL_SESSION_UNAVAILABLE" } }, { status, headers });
const cookie = (value: string, age: number) =>
  `${cookieName}=${value}; Path=${sessionPath}; HttpOnly; SameSite=Strict; Max-Age=${age}`;

function sessionId(request: Request) {
  const values = (request.headers.get("cookie") ?? "").split(";")
    .map(part => part.trim()).filter(part => part.startsWith(cookieName + "="));
  return values.length === 1 ? values[0].slice(cookieName.length + 1) : "";
}

/** Browser-facing adapter restricted to the local development origin and read/propose/test routes. */
export class LocalWorkspaceServer {
  private readonly store: LocalSessionStore;
  private readonly fetcher: typeof fetch;
  constructor(store: LocalSessionStore, fetcher: typeof fetch = fetch) { this.store = store; this.fetcher = fetcher; }
  private trusted(request: Request) {
    const url = new URL(request.url);
    // NextRequest normalizes loopback URLs to localhost. The actual Host/Origin must still be exact.
    return url.protocol === "http:" && url.port === "3000" && ["127.0.0.1", "localhost"].includes(url.hostname)
      && request.headers.get("host") === "127.0.0.1:3000"
      && request.headers.get("x-cachesec-workspace") === "1"
      && request.headers.get("sec-fetch-site") === "same-origin"
      && (!request.headers.has("origin") || request.headers.get("origin") === localOrigin)
      && (request.method === "GET" || request.headers.get("origin") === localOrigin);
  }
  private upstream(path: string, token: string, signal?: AbortSignal, init: RequestInit = {}) {
    const origin = path.startsWith("/api/v1/quotations") ? "http://127.0.0.1:8001" : "http://127.0.0.1:8000";
    return this.fetcher(origin + path, {
      ...init, cache: "no-store", credentials: "omit", redirect: "error",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(path.startsWith("/api/v1/agent/") ? 90000 : 15000)])
        : AbortSignal.timeout(15000),
      headers: { ...init.headers, Authorization: "Bearer " + token },
    });
  }
  async session(request: Request) {
    if (!this.trusted(request) || new URL(request.url).search) return failure(403);
    try {
      if (request.method === "DELETE") {
        await this.store.remove(sessionId(request));
        return Response.json({ connected: false }, { headers: { ...headers, "Set-Cookie": cookie("", 0) } });
      }
      if (request.method === "GET") {
        try {
          const session = await this.store.session(sessionId(request), localOrigin);
          return Response.json({ connected: true, expires_at: session.data.expires }, { headers });
        } catch { return Response.json({ connected: false }, { headers }); }
      }
      if (request.method !== "POST") return failure(405);
      if (request.headers.get("content-type") !== "application/json") return failure(400);
      const body = await limitedBody(request, 128);
      const value: unknown = JSON.parse(body);
      if (!value || typeof value !== "object" || !("launch" in value)
        || typeof value.launch !== "string" || Object.keys(value).length !== 1) return failure(400);
      let claimed;
      try { claimed = await this.store.consumeLaunch(value.launch, localOrigin); }
      catch { return failure(401); }
      // A local session never turns an invalid/revoked backend credential into a login.
      const result = await this.upstream("/api/v1/repository", claimed.token, request.signal);
      if (!result.ok) return failure(result.status === 401 || result.status === 403 ? result.status : 503);
      const credential = await this.store.credential();
      if (credential.digest !== claimed.data.credential) return failure(401);
      const quotation = await this.store.quotationCredential().catch(() => null);
      if (claimed.data.quotation && claimed.data.quotation !== quotation?.digest) return failure(401);
      const session = await this.store.createSession(localOrigin, credential.digest, Date.now(), claimed.data.quotation ?? null);
      return Response.json({ connected: true, expires_at: session.expires }, {
        headers: { ...headers, "Set-Cookie": cookie(session.value, sessionLifetime / 1000) },
      });
    } catch (error) { return failure(error instanceof BodyTooLarge ? 413 : error instanceof SyntaxError ? 400 : 503); }
  }
  async proxy(request: Request) {
    if (!this.trusted(request)) return failure(403);
    const url = new URL(request.url);
    const path = url.pathname.slice(sessionPath.length);
    const quotation = (quotationRoutes[request.method] ?? []).some(pattern => pattern.test(path));
    if (!quotation && !(routes[request.method] ?? []).some(pattern => pattern.test(path))) return failure(404);
    if (url.search && !(quotation && request.method === "GET" && path === "/api/v1/quotations"
      && [...url.searchParams.keys()].length === 1 && url.searchParams.has("cursor")
      && new RegExp(`^${uuid}$`).test(url.searchParams.get("cursor")!))) return failure(403);
    let session;
    try { session = await (quotation ? this.store.quotationSession(sessionId(request), localOrigin)
      : this.store.session(sessionId(request), localOrigin)); }
    catch { return failure(401); }
    try {
      const body = request.method === "POST" ? await limitedBody(request, 400000) : undefined;
      if (body && request.headers.get("content-type") !== "application/json") return failure(400);
      if (path === "/api/v1/repository/snapshots" && body) return failure(400);
      if (quotation && path.endsWith("/validate") && body) return failure(400);
      const key = request.headers.get("idempotency-key");
      if (key && !/^[\x21-\x7e]{1,200}$/.test(key)) return failure(400);
      const result = await this.upstream(path + url.search, session.token, request.signal, {
        method: request.method, body: body || undefined,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
      });
      // Never relay cookies, CORS, redirects or arbitrary upstream headers.
      if (result.status === 401 && !quotation) await this.store.remove(sessionId(request));
      if (result.status >= 300 && result.status < 400) return failure(502);
      return new Response(result.body, { status: result.status, headers: { ...headers, "Content-Type": "application/json" } });
    } catch (error) { return failure(error instanceof BodyTooLarge ? 413 : 503); }
  }
}

class BodyTooLarge extends Error {}
async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) { await reader.cancel(); throw new BodyTooLarge(); }
      parts.push(part.value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts));
  } finally { reader.releaseLock(); }
}
