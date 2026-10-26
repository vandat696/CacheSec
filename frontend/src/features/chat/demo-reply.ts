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
  return `Đây là phản hồi mô phỏng để bạn trải nghiệm giao diện.\n\nVới yêu cầu “${prompt}”, bạn có thể bắt đầu bằng ba bước:\n1. Xác định kết quả muốn đạt được.\n2. Chia nội dung thành những phần nhỏ, dễ thực hiện.\n3. Chọn một bước ưu tiên để bắt đầu.\n\nKhi kết nối mô hình AI, nội dung thực tế sẽ xuất hiện tại đây.`;
}
