# CacheSec

Đồ án nghiên cứu **chatbot AI nội bộ dùng RAG + LLM và cache có kiểm soát quyền truy cập**.

Mục tiêu: đo cache nhanh hơn, tiết kiệm hơn trong điều kiện nào; câu trả lời có đúng và có tuân thủ quyền không. Local Semantic Cache là trọng tâm, server cache là phương án đối chiếu.

## Trạng thái

Đã tích hợp giao diện Nói vào Next.js: màn chat mô phỏng và thư viện 21 component React/TypeScript. FastAPI có endpoint health; Docker Compose có PostgreSQL/pgvector. Chưa có chatbot AI thật, cache, xác thực, database adapter hoặc kết quả benchmark. Xem [hướng dẫn chạy](docs/general/setup.md) và [trạng thái kiểm chứng](docs/general/project-status.md).

## Ba màn hình dự kiến

- **So sánh chatbot:** một câu hỏi chung, hai khung A/B chọn cấu hình. Mặc định không cache so với secure local cache.
- **Thí nghiệm và kết quả:** chạy bộ câu hỏi có nhãn, lưu cấu hình và số liệu, xem biểu đồ và xuất JSON/CSV.
- **Cấu hình và phân quyền:** chọn model, thuật toán, tham số; quản lý người dùng, role và rule trong phạm vi thử nghiệm.

Mỗi khung hiển thị câu trả lời, nguồn, thời gian, token, chi phí ước tính, quyền và cache hit/miss nếu có.

## Các phần có thể thay thế

| Phần | Lựa chọn dự kiến |
| --- | --- |
| Cache | Không cache, local, server; hai tầng để sau |
| Matching | Exact match, semantic similarity |
| Chính sách cache | Ngưỡng, TTL, dung lượng, eviction |
| AI | LLM và embedding có adapter riêng; API trước, endpoint local sau |
| RAG | Chunking, top-k, phương pháp truy xuất |
| Quyền | RBAC, điều kiện ABAC; chi tiết chưa chốt |

Thiết kế điểm thay thế rõ ràng, triển khai từng lựa chọn khi cần. Chưa làm hệ thống plugin hay editor rule/thuật toán tùy ý.

## Công nghệ và thư mục

| Thư mục | Trách nhiệm và công nghệ dự kiến |
| --- | --- |
| frontend/ | Next.js/TypeScript, giao diện, API client, browser cache qua IndexedDB/Dexie |
| backend/ | Python/FastAPI, phân quyền, RAG, model adapter, server cache |
| research/ | Python, dữ liệu giả lập, thử thuật toán và phân tích |
| docs/ | Thiết kế theo chủ đề, quyết định và câu hỏi mở |
| infra/ | Cấu hình môi trường và triển khai |

PostgreSQL + pgvector cho dữ liệu và vector tài liệu RAG. Storage server cache cụ thể chưa chốt. Python nghiên cứu không thay thế TypeScript cần chạy trong trình duyệt. Bắt đầu bằng module đơn giản; chỉ tách thêm thư mục khi cần.

## Nguyên tắc chính

- Similarity không phải quyền truy cập. Backend xác minh quyền hiện tại và metadata đáng tin cậy trước khi ứng dụng dùng lại cache.
- Baseline và cache đều phân quyền khi retrieval/generation, so sánh trong điều kiện tương đương.
- Tách cold/warm; tính cả embedding, lookup, xác minh quyền và mạng. Không mặc định cache luôn nhanh hơn.
- Đánh giá riêng chất lượng và phân quyền; lưu cấu hình cùng kết quả.
- Dùng dữ liệu giả lập. Chặn reuse không bảo vệ plaintext khỏi người kiểm soát thiết bị, không thu hồi nội dung đã đọc.

## Tài liệu

Đọc [mục lục docs](docs/README.md) để đọc thiết kế và trạng thái hệ thống. [AGENTS.md](AGENTS.md) và [Copilot instructions](.github/copilot-instructions.md) hướng dẫn AI làm việc trong repository.
