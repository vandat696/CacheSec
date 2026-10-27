// UI simulation only. This module does not call an AI model or produce measurements.
import type { ChatBranch } from "./chat-state";

export async function createDemoReply(
  prompt: string,
  signal: AbortSignal,
  branch: ChatBranch = "no-cache",
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    signal.addEventListener("abort", abort, { once: true });
  });
  return branch === "cache"
    ? "Đây là phản hồi mẫu cho chế độ có cache. Cache chưa được triển khai; Chat chưa kết nối AI hoặc kho tài liệu."
    : "Đây là phản hồi mẫu cho chế độ không cache. Chat chưa kết nối AI hoặc kho tài liệu.";
}
