import { ChangeApiError, type ChangeWorkflowClient } from "./changeWorkflowApi.ts";
import { operationPending, type WorkspaceOperation } from "./workspaceRuntimeModel.ts";

export async function waitForOperation(api: ChangeWorkflowClient, initial: WorkspaceOperation, signal: AbortSignal,
  progress: (operation: WorkspaceOperation) => void = () => {}) {
  let operation = initial;
  const deadline = performance.now() + 120000;
  progress(operation);
  while (operationPending(operation)) {
    if (performance.now() >= deadline) throw new ChangeApiError(409, "OPERATION_PENDING");
    await new Promise<void>((resolve, reject) => {
      signal.throwIfAborted();
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 300);
      signal.addEventListener("abort", abort, { once: true });
    });
    operation = await api.operation(operation, signal);
    progress(operation);
  }
  if (operation.status !== "succeeded") throw new ChangeApiError(409,
    operation.status === "unknown" ? "OPERATION_UNKNOWN" : operation.reason ?? undefined);
  return operation;
}
