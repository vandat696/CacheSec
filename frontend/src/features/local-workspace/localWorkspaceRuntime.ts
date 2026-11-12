import "server-only";
import { resolve } from "node:path";
import { LocalSessionStore } from "./localSessionStore";
import { LocalWorkspaceServer } from "./localWorkspaceServer";

// next dev/start run from frontend; no client-provided URL, credential path or tenant.
export const localWorkspace = new LocalWorkspaceServer(new LocalSessionStore(resolve(process.cwd(), "../backend/.local")));
