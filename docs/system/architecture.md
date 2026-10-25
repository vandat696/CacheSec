# Kiến trúc hệ thống

## Đã thống nhất

Next.js gọi FastAPI qua HTTP; PostgreSQL/pgvector cho dữ liệu và RAG; TypeScript/IndexedDB cho browser cache. Model API trước, endpoint local sau.

## Các trách nhiệm logic

| Phần | Trách nhiệm |
| --- | --- |
| Chat | Điều phối, không gắn cứng provider |
| LLM adapter | Sinh câu trả lời, chuẩn hóa usage và lỗi |
| Embedding adapter | Vector, model/revision, chiều và chuẩn hóa |
| RAG | Ingest/chunk/retrieve nguồn được phép |
| Storage | Đọc/ghi/xóa và giới hạn lưu trữ |
| Matching | Exact/semantic, xếp hạng ứng viên |
| Validation | Freshness, tương thích, quyền đáng tin cậy |
| Experiment runner | Cấu hình, đo và lưu kết quả |

Không yêu cầu mỗi trách nhiệm thành microservice/class riêng.

## Luồng request cần đặc tả

Xác thực/profile → tìm ứng viên (embedding nếu cần) → backend xác minh → hit hợp lệ hoặc fallback RAG có phân quyền → LLM → ghi cache và telemetry an toàn.

Ứng viên không hợp lệ không có nghĩa câu hỏi bị cấm; fallback tự kiểm tra quyền. Không tin nguồn/quyền chỉ do client khai.

## Vị trí và scope

None/local/server là chế độ dự kiến; hai tầng để sau. Riêng người dùng hay dùng chung tenant khác với vị trí lưu. Storage server và giao thức xác minh local chưa chốt.

## Tổ chức code

Module đơn giản trong backend/app; frontend/src/lib giữ API client/cache. research có thể dùng backend; backend không phụ thuộc script nghiên cứu. Chỉ tách package khi cần.

## Cần chốt

Hợp đồng request/response, timeout/streaming, capability provider, nơi lưu metadata tin cậy, schema profile và kết quả.
## Dữ liệu và hợp đồng API cần thiết kế

- Thực thể người dùng/tenant/quyền, tài liệu/chunk, profile và kết quả thí nghiệm.
- Quan hệ, nơi lưu, phiên bản, request/response và lỗi phải được chốt trước khi triển khai nghiệp vụ.
- LLM và embedding có hợp đồng riêng; cần thiết kế capability, usage và lỗi của từng provider.
- API hiện có: GET /health trả {"status":"ok"}; chỉ xác nhận process liveness, không kiểm tra database/model. CORS local không phải phân quyền.

Xem [cache](cache.md), [phân quyền](authorization.md), [frontend](../frontend/design.md) và [cài đặt](../general/setup.md).
