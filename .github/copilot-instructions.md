# CacheSec — Copilot instructions

- Đọc [AGENTS.md](../AGENTS.md), [README.md](../README.md), [mục lục docs](../docs/README.md) và tài liệu liên quan.
- AGENTS.md là bộ quy tắc chung về bảo mật, nghiên cứu, kiến trúc và phạm vi; tuân thủ đầy đủ, không duy trì chính sách khác ở đây.
- Trả lời tiếng Việt. Thảo luận không cho phép sửa code; sửa tài liệu không cho phép scaffold ứng dụng.
- CacheSec nghiên cứu Secure Local Semantic Cache for AI-Assisted Software Development; AI Coding Agent hỗ trợ đúng một thay đổi validation ngày hết hạn báo giá giả lập. Xem [tổng quan](../docs/general/overview.md).
- Cache verification kiểm soát reuse thông tin; approval gate tại backend/deployment control kiểm soát triển khai đúng thay đổi đã được người có thẩm quyền duyệt. Không dùng cache để bỏ quyền, test hoặc approval; không nhầm duyệt code với duyệt báo giá.
- Thí nghiệm chính là Developer-guided/AI-assisted; Cache/No Cache chỉ là phép thử phụ đề xuất. Một repo, một fixture, một gate implementation, một acceptance threshold định trước; giá trị threshold chưa chốt. Không tự xây lại frontend hoặc mở rộng nghiệp vụ.
- Next.js/TypeScript, Python/FastAPI, PostgreSQL/pgvector, browser IndexedDB/Dexie. Storage server cache chưa chốt.
- Tách LLM/embedding, storage/matching/validation; backend xác minh quyền đáng tin cậy.
- Đọc project-status để biết trạng thái thực tế. Không mô tả đề xuất thành tính năng đã triển khai.
