import Dexie, { type Table } from "dexie";
import { isContextEntry, matchContextEntries, type ContextEntry, type ContextRequest, type LookupReport } from "./contextCacheModel.ts";

type StoredEntry = ContextEntry & { last_used_at: number };
type Session = { key: "session"; epoch: string; partition: string | null; namespace: string | null };

export class DexieContextCache {
  private database: Dexie;
  private entries: Table<StoredEntry, string>;
  private metadata: Table<Session, string>;
  private clock: () => number;
  constructor(name = "cachesec-context-v1", clock = () => Date.now() / 1000) {
    this.clock = clock;
    this.database = new Dexie(name);
    this.database.version(1).stores({ entries: "&entry_id,namespace,partition,expires_at,last_used_at", metadata: "&key" });
    this.entries = this.database.table("entries"); this.metadata = this.database.table("metadata");
  }
  async begin() {
    return this.database.transaction("rw", this.metadata, async () => {
      let session = await this.metadata.get("session");
      if (!session) { session = { key: "session", epoch: crypto.randomUUID(), partition: null, namespace: null }; await this.metadata.put(session); }
      return session.epoch;
    });
  }
  async lookup(request: ContextRequest, expectedEpoch?: string): Promise<{ report: LookupReport; epoch: string; state: "cold" | "warm" }> {
    // None never opens IndexedDB, looks up entries or warms the Local namespace.
    if (request.mode === "none") return { report: { kind: "not_applicable" }, epoch: "", state: "cold" };
    return this.database.transaction("rw", this.entries, this.metadata, async () => {
      let session = await this.metadata.get("session");
      if (expectedEpoch !== undefined && session?.epoch !== expectedEpoch) throw new Error("CACHE_SESSION_CHANGED");
      if (!session || session.partition !== request.partition || session.namespace !== request.namespace) {
        await this.entries.clear();
        session = { key: "session", epoch: crypto.randomUUID(), partition: request.partition, namespace: request.namespace };
        await this.metadata.put(session);
      }
      await this.entries.where("expires_at").belowOrEqual(this.clock()).delete();
      // Whole-snapshot/config invalidation; never retain entries from another namespace.
      await this.entries.filter(entry => entry.namespace !== request.namespace).delete();
      const entries = await this.entries.where("namespace").equals(request.namespace).toArray();
      const report = matchContextEntries(request, entries, this.clock());
      if (report.kind === "candidate") for (const candidate of report.candidates)
        await this.entries.update(candidate.entry_id, { last_used_at: this.clock() });
      return { report, epoch: session.epoch, state: entries.length ? "warm" : "cold" };
    });
  }
  async admit(entry: ContextEntry, epoch: string): Promise<boolean> {
    if (!isContextEntry(entry)) throw new Error("INVALID_CONTEXT_ADMISSION");
    return this.database.transaction("rw", this.entries, this.metadata, async () => {
      const session = await this.metadata.get("session");
      // Logout/account switch invalidates writes from requests already in flight.
      if (!session || session.epoch !== epoch || session.partition !== entry.partition || entry.expires_at <= this.clock()) return false;
      await this.entries.put({ ...entry, last_used_at: this.clock() });
      const surplus = (await this.entries.count()) - 100;
      if (surplus > 0) await this.entries.bulkDelete((await this.entries.orderBy("last_used_at").limit(surplus).toArray()).map(item => item.entry_id));
      return true;
    });
  }
  async clear() {
    await this.database.transaction("rw", this.entries, this.metadata, async () => {
      await this.entries.clear(); await this.metadata.put({ key: "session", epoch: crypto.randomUUID(), partition: null, namespace: null });
    });
  }
  close() { this.database.close(); }
}

let browserCache: DexieContextCache | undefined;
export function getBrowserContextCache() { return browserCache ??= new DexieContextCache(); }
export async function clearBrowserContextCache() { await getBrowserContextCache().clear(); }
