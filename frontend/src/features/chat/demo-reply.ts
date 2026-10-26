// UI simulation only. This module does not call an AI model or produce measurements.
export async function createDemoReply(
  prompt: string,
  signal: AbortSignal,
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
  return "Đây là phản hồi mẫu. Chat chưa kết nối AI hoặc kho tài liệu.";
}
