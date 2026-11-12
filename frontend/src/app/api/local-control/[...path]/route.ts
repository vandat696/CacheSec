import { localWorkspace } from "@/features/local-workspace/localWorkspaceRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => localWorkspace.proxy(request);
export const POST = (request: Request) => localWorkspace.proxy(request);
