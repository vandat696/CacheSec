# Trạng thái dự án

## 2026-10-26 — Tích hợp giao diện Nói

### Đã triển khai

- Chuyển bộ thiết kế sang React/TypeScript: chat mô phỏng tại `/`, thư viện 21 component tại `/ui`, dùng chung tokens và khung điều hướng responsive.
- Tách `components/ui`, `components/layout`, `features/chat`, `features/ui-library` và stylesheet theo trách nhiệm. Giữ bản xuất gốc tại `frontend/design-reference`; không thêm dependency ứng dụng.
- Chat có lịch sử/bản nháp trong bộ nhớ, trạng thái chờ và sao chép; logic trạng thái tách khỏi UI, tác vụ mô phỏng hủy khi unmount. Thư viện có tìm/lọc, validation, menu/tab/dialog bằng bàn phím, biểu đồ và dữ liệu rỗng.
- Cập nhật [thiết kế và cấu trúc frontend](../frontend/design.md), [hướng dẫn chạy/kiểm tra](setup.md) và README.

### Đã kiểm chứng

- Frontend lint không có lỗi/cảnh báo; TypeScript và production build đạt; 7 test trạng thái/hủy tác vụ đạt.
- Edge headless trên bản production: kiểm tra tương tác, clipboard thành công/bị chặn, hiển thị tin nhắn chứa HTML dưới dạng văn bản, điều hướng route, focus drawer và reduced motion đạt; không ghi nhận lỗi runtime/React/hydration.
- Cả hai route không tràn ngang tại 360×800, 390×844, 430×932, 600×960, 820×1180, 1024×768, 1366×768, 1440×900 và 1920×1080. Đã lưu ảnh kiểm chứng và ảnh bản xuất gốc tại ba cỡ 390, 820, 1440 trong `frontend/test-results/browser/` (không commit).
- Đã sửa lỗi SSR của SVG title và làm tròn tọa độ lượng giác để Node/browser tạo markup nhất quán. Đã kiểm tra link nội bộ, whitespace và diff.

### Giới hạn và bước tiếp theo

- Chat vẫn là mô phỏng, mất dữ liệu khi tải lại/rời màn; chưa tích hợp backend/model, cache, xác thực hay phân quyền. Số liệu thư viện là dữ liệu mẫu, không phải kết quả benchmark.
- Ba màn hình nghiên cứu vẫn là thiết kế dự kiến; cần chốt API/dữ liệu/quyền trước khi thay phản hồi mô phỏng bằng chatbot baseline. Chưa kiểm tra Safari/Firefox hoặc thiết bị thật.
- Node test runner có cảnh báo nhận dạng ES module khi đọc TypeScript, không làm test thất bại. Một số lượt build/browser cần chạy ngoài sandbox do process con bị chặn; bản build và lượt kiểm tra cuối đã đạt.

## 2026-10-26 — Thiết lập nền phát triển

### Đã triển khai

- Next.js 16.4.3, React 19.3.1, TypeScript, App Router, CSS thuần, ESLint; trang scaffold và npm lockfile.
- FastAPI/Python 3.12, Pydantic Settings, GET /health, CORS cho frontend local, pytest và Ruff; môi trường backend/.venv và bản freeze dependencies.
- Docker Compose PostgreSQL 17 + pgvector 0.8.7: localhost port, volume, healthcheck, script khởi tạo extension.
- Hướng dẫn chạy và ghi chú nền phát triển trong [setup.md](setup.md).

### Đã kiểm chứng

- Frontend: lint, TypeScript và production build đạt. Compiler SWC bị lỗi sau lượt tải gián đoạn đã được tải lại; build sau đó thành công.
- Backend: Ruff lint/format, 2 test health/CORS đạt; pip check không có xung đột.
- Compose config và git diff --check đạt; chưa chạy database thực tế.

### Giới hạn và việc còn mở

- Docker CLI có nhưng Linux Engine chưa chạy trên máy; cần khởi động Docker Desktop để kiểm chứng PostgreSQL/extension.
- Backend test có cảnh báo deprecation TestClient/httpx và cache pytest không ghi được trong sandbox; không làm test thất bại.
- npm báo ESLint 9 hết hỗ trợ; giữ phiên bản tương thích eslint-config-next đã resolve, cần xem lại khi nâng tooling.
- Chưa tích hợp frontend/backend, DB adapter/migration, authentication, RAG, model, cache hoặc benchmark; chưa có kết quả nghiên cứu.
- Tài liệu mới mô tả định hướng, chưa đặc tả đầy đủ. Bước tiếp theo là chốt hợp đồng dữ liệu/API và phân quyền trước khi làm chatbot baseline.

## Định hướng và việc còn mở

### Định hướng đã thống nhất

- Secure local semantic cache là trọng tâm, none/server là đối chiếu.
- Profile A/B linh hoạt, ba màn hình trong frontend/design.md.
- Next.js, FastAPI/Python, PostgreSQL/pgvector, browser IndexedDB/Dexie.
- API model trước, local/fine-tune sau; tách LLM/embedding.
- Tách storage/matching/validation, tránh abstraction quá mức.
- Scaffold đã có; nghiệp vụ chatbot/cache/AI vẫn chưa triển khai.

### Còn mở

| Chủ đề | Cần quyết định | Tài liệu |
| --- | --- | --- |
| UI/phạm vi | Streaming, multi-turn, quản trị tối thiểu | frontend/design.md |
| Kiến trúc | Server storage, metadata tin cậy, API, profile persistence | system/architecture.md |
| Bảo mật | RBAC/ABAC, threat model, toàn vẹn, offline | system/cache.md và system/authorization.md |
| Cache | Metric/ngưỡng, TTL, eviction, schema, scope | system/cache.md và system/authorization.md |
| AI | Provider/model, embedding, nơi chạy | system/architecture.md |
| Đánh giá | Dataset/nhãn, số lượt, công thức, thống kê | evaluation/design.md |


## Thứ tự tiếp theo đề xuất

1. Chốt phạm vi và threat model.
2. Chốt metadata, hợp đồng API, ma trận quyền.
3. Chốt workload, nhãn và cách đo.
4. Triển khai chatbot baseline và đo đạc, sau đó cache adapter.
5. Kiểm thử và benchmark trước khi kết luận.

Quyết định mới ghi nội dung, lý do, lựa chọn cân nhắc và ảnh hưởng đến so sánh; chi tiết giữ tại tài liệu chủ đề, không lặp lại ở nhiều nơi.

## Cập nhật tài liệu

Đã gom tài liệu đánh số và các file rỗng vào 9 file trong cấu trúc general/system/frontend/evaluation. Giữ nội dung thiết kế, trạng thái và hướng dẫn chạy; không thay đổi code ứng dụng. Đã kiểm tra liên kết nội bộ, tham chiếu đường dẫn cũ và whitespace.
