// Illustrative content for the UI, not source read from the repository or experiment evidence.
export const previewTask = "Bổ sung quy tắc đánh dấu báo giá thiếu ngày hết hạn hợp lệ để con người xem xét.";

export const exampleQuestions = ["Validation nằm ở đâu?", "Vì sao có thể dùng lại cache?", "Thay đổi này cần ai phê duyệt?"];

export const exampleTests = [
  { id: "QV-01", input: "Không có trường ngày hết hạn", expected: "Cần xem xét" },
  { id: "QV-02", input: "Ngày hết hạn là null", expected: "Cần xem xét" },
  { id: "QV-03", input: "Ngày không tồn tại: 2026-02-30", expected: "Cần xem xét" },
  { id: "QV-04", input: "Ngày hợp lệ theo policy mẫu", expected: "Giữ kết quả validation" },
] as const;

export type DiffLine = { type: "context" | "added"; code: string; line: number };
export function previewDiff(revision: number): DiffLine[] {
  const reason = revision % 2 ? "Missing or invalid expiration date" : "Expiration date requires human review";
  return [
    { type: "context", line: 18, code: "def validate_quotation(quotation, policy):" },
    { type: "context", line: 19, code: "    flags = validate_required_fields(quotation)" },
    { type: "context", line: 20, code: "" },
    { type: "added", line: 21, code: "    expiration = quotation.get(\"expires_on\")" },
    { type: "added", line: 22, code: "    if not policy.is_valid_expiration(expiration):" },
    { type: "added", line: 23, code: "        flags.append({" },
    { type: "added", line: 24, code: "            \"code\": \"expiration_review\"," },
    { type: "added", line: 25, code: `            "reason": "${reason}",` },
    { type: "added", line: 26, code: "            \"requires_human_review\": True," },
    { type: "added", line: 27, code: "        })" },
    { type: "context", line: 28, code: "" },
    { type: "context", line: 29, code: "    return flags" },
  ];
}

export function previewAnswer(question: string): string {
  const normalized = question.toLocaleLowerCase("vi");
  if (normalized.includes("cache")) return "Trong kịch bản mẫu, hai câu hỏi cùng tìm vị trí validation. Candidate chỉ được reuse sau khi kiểm tra quyền, nguồn và phiên bản. Bạn có thể chuyển Hit / Miss / Rejected ở thẻ Local Semantic Cache để xem các nhánh minh họa.";
  if (normalized.includes("duyệt")) return "Reviewer có thẩm quyền phải xem và duyệt đúng thay đổi. Trong bản mẫu, hãy xem kết quả test, mở tab Phê duyệt và xác nhận đúng revision. Đổi bản sửa sẽ đặt lại quyết định. Triển khai thật chưa được kết nối.";
  if (normalized.includes("validation") || normalized.includes("ở đâu")) return "Trong repository minh họa, validation nằm tại quotation_demo/service.py, hàm validate_quotation(). Diff bên phải bổ sung cờ expiration_review và giữ phần kiểm tra hiện có. File này là nội dung mẫu, chưa được đọc từ repository thật.";
  return "Mình đã nhận yêu cầu trong bản xem trước. Đề xuất mẫu bên phải minh họa một thay đổi về ngày hết hạn báo giá. Bạn có thể xem diff, kết quả test và thử phê duyệt; chưa có Agent xử lý hoặc sửa repository thật.";
}
