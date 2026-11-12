import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";

export const localOrigin = "http://127.0.0.1:3000";
export const sessionLifetime = 8 * 60 * 60 * 1000;
export const launchLifetime = 60 * 1000;
export const cookieName = "cachesec_workspace";
export const sessionPath = "/api/local-control";
const capability = /^[a-f0-9]{64}$/;
type RecordData = { origin: string; expires: number; credential: string };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Host-owned files only. No permissions or backend authorization decisions are stored here. */
export class LocalSessionStore {
  readonly root: string;
  private readonly credentialFile: string;
  constructor(localRoot: string) {
    this.root = join(localRoot, "workspace-sessions");
    this.credentialFile = join(localRoot, "control-access.env");
  }
  async credential() {
    const raw = await readFile(this.credentialFile, "utf8");
    if (Buffer.byteLength(raw) > 70000) throw new Error("LOCAL_CREDENTIAL_UNAVAILABLE");
    const token = parseEnv(raw).CONTROL_REPOSITORY_READ_TOKEN;
    if (!token || !/^[\x21-\x7e]{32,65536}$/.test(token)) throw new Error("LOCAL_CREDENTIAL_UNAVAILABLE");
    return { token, digest: digest(token) };
  }
  private file(kind: "launch" | "sessions", value: string) {
    if (!capability.test(value)) throw new Error("INVALID_SESSION");
    return join(this.root, kind, digest(value) + ".workspace-session.json");
  }
  private async create(kind: "launch" | "sessions", data: RecordData) {
    await mkdir(join(this.root, kind), { recursive: true, mode: 0o700 });
    const value = randomBytes(32).toString("hex");
    await writeFile(this.file(kind, value), JSON.stringify(data), { flag: "wx", mode: 0o600 });
    return value;
  }
  private async read(kind: "launch" | "sessions", value: string, origin: string, now: number) {
    const data: RecordData = JSON.parse(await readFile(this.file(kind, value), "utf8"));
    const credential = await this.credential();
    if (data.origin !== origin || data.credential !== credential.digest
      || !Number.isSafeInteger(data.expires) || data.expires <= now
      || data.expires > now + (kind === "launch" ? launchLifetime : sessionLifetime)) {
      throw new Error("INVALID_SESSION");
    }
    return { data, token: credential.token };
  }
  async issueLaunch(now = Date.now()) {
    const credential = await this.credential();
    return this.create("launch", { origin: localOrigin, credential: credential.digest, expires: now + launchLifetime });
  }
  async consumeLaunch(value: string, origin: string, now = Date.now()) {
    const result = await this.read("launch", value, origin, now);
    const path = this.file("launch", value);
    // Atomic rename is the single-use claim, including across Next.js workers.
    await rename(path, path + ".claimed");
    await unlink(path + ".claimed");
    return result;
  }
  async createSession(origin: string, credential: string, now = Date.now()) {
    const expires = now + sessionLifetime;
    const value = await this.create("sessions", { origin, credential, expires });
    return { value, expires };
  }
  async session(value: string, origin: string, now = Date.now()) {
    return this.read("sessions", value, origin, now);
  }
  async remove(value: string) {
    if (capability.test(value)) await unlink(this.file("sessions", value)).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
