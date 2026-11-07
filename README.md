# CacheSec

**Secure Local Semantic Cache for AI-Assisted Software Development.** CacheSec nghiên cứu tái sử dụng an toàn kết quả AI đã xử lý để giảm công việc lặp lại, thời gian, lượt gọi LLM và token, đồng thời kiểm tra tính đúng, quyền truy cập và hiệu lực nguồn. AI Coding Agent hỗ trợ Developer là bối cảnh ứng dụng; Secure Local Semantic Cache là kiến trúc nghiên cứu cốt lõi.

## Kịch bản và phạm vi

Trong ứng dụng tiếp nhận báo giá nhà cung cấp giả lập, Developer cần thêm **đúng một quy tắc**: đánh dấu báo giá thiếu ngày hết hạn hợp lệ để con người xem xét. Agent hỗ trợ tìm hiểu repository, đề xuất patch và chạy test.

**Safety property duy nhất:** không triển khai thay đổi quy tắc validation khi chưa có người có thẩm quyền phê duyệt tường minh **chính xác thay đổi đó**. Approval phải gắn phiên bản/hash và thực thi tại backend/deployment control; đây là duyệt code, không phải duyệt báo giá. Cache verification kiểm soát reuse thông tin, không thay thế authorization, testing hoặc human approval.

Thí nghiệm chính so sánh **Developer-guided baseline / AI-assisted workflow**, cùng repo gốc, tập báo giá đóng băng, gate và quy tắc đo. Giới hạn: **một repository, một test fixture, một approval-control implementation, một acceptance threshold định trước**; giá trị threshold còn cần thống nhất. Đo năm chiều: correctness of flags, approval gate, reproducibility, trace completeness, engineering time/failures. So sánh AI Cache/No Cache là phép thử phụ đề xuất, chưa phải yêu cầu giảng viên đã xác nhận.

## Kiến trúc mục tiêu

Developer request → local lookup → authorization & cache verification → reuse hợp lệ hoặc authorized repository retrieval/RAG → AI Agent tạo patch → test → human approval gắn đúng thay đổi → deployment & audit.

Theo lựa chọn người dùng ngày **2026-11-07**, PoC bắt đầu bằng **Repository Context Cache trong trình duyệt cho web Workspace**; adapter IDE làm sau. Hit hợp lệ tái sử dụng ngữ cảnh repo đã chuẩn bị, LLM vẫn xử lý yêu cầu/tạo patch; chưa có bảo đảm giảm calls/tokens hoặc lợi ích đã đo. Backend phải xác minh identity/tenant/repo, intent/scope, mọi nguồn/version/hash, TTL, policy và toàn vẹn trước khi Agent dùng payload local. Answer Cache giữ làm hướng mở rộng. Similarity không phải quyền; cached context không chứng minh code hiện tại đúng.

## Trạng thái thực tế

Bối cảnh đã cập nhật ngày **2026-11-02**. Frontend có thêm **Developer Workspace tại `/workspace`** để xem thử workflow mới; các màn chatbot nội bộ cũ tiếp tục được giữ để tái sử dụng.

| Thành phần | Hiện có | Giới hạn |
| --- | --- | --- |
| Workspace `/workspace` | Bố cục IDE code/chat, diff/bản gốc, hộp thoại test/phê duyệt theo revision và nhật ký thu gọn | Chỉ mô phỏng UI trong phiên; không đọc/sửa repo, gọi Agent, chạy test nghiệp vụ hoặc deploy |
| Thiết lập `/setup` | Chín nhóm mode/dataset/embedding/threshold/eviction/quyền/training/logging/export; snapshot trong phiên, validation và xuất JSON cấu hình | Bản nháp; results null, chưa áp dụng vào Chat hoặc chạy benchmark/training/logging thật |
| Chat `/` | Lịch sử, bản nháp, Không cache/Cache/Cả hai với prompt chung; modal thông số từng lượt | Phản hồi mô phỏng, chưa AI/RAG hoặc cache thật |
| Số liệu `/metrics` | Ba tab, biểu đồ/bảng/chi tiết; mặc định 24 truy vấn giả, nguồn phiên riêng tại `/metrics?source=session` | Fixture xem UI, không phải kết quả thực nghiệm |
| Tài liệu `/documents` | Chọn/thả, phân loại, tìm/lọc tệp trong phiên | Chờ tải lên; chưa đọc/ingest/upload hoặc authorized retrieval |
| Backend | FastAPI `GET /health`, `GET /ready`, adapter kết nối PostgreSQL/Psycopg, CORS local | Readiness chỉ kiểm tra PostgreSQL; chưa auth, API nghiệp vụ, Agent hoặc gate |
| Báo giá | Domain models, migration và PostgreSQL store tạo/đọc/phân trang, config riêng | Chưa API/UI/runtime validation hoặc rule mới |
| Hạ tầng | PostgreSQL 17.11/pgvector 0.8.7 qua Compose; đã áp dụng migration báo giá và kiểm chứng DB thật | Chưa schema/control/artifact của workflow |

App báo giá hiện có phần domain/storage, chưa chạy thành ứng dụng HTTP/UI độc lập. Chưa có fixture báo giá đóng băng, Local Semantic Cache, embedding/matching/verification, RBAC/ABAC thực thi, model adapter, backend approval/deployment control, audit log hoặc runner thực nghiệm. Change Review/Phê duyệt/Nhật ký trong Workspace mới là bản mẫu; nút Triển khai luôn khóa. Dữ liệu demo không phải số đo hoặc bằng chứng quyền. Chat/tệp/cấu hình nháp mất khi tải lại; chọn RBAC/ABAC trong UI không cấp quyền.

## Công nghệ và tổ chức

| Thư mục | Vai trò |
| --- | --- |
| `frontend/` | Next.js/TypeScript; UI hiện có. Browser cache IndexedDB/Dexie mới là dự kiến, chưa có dependency Dexie |
| `backend/` | Python/FastAPI; dự kiến authorization, authorized RAG, model/Agent adapter, verification và approval/deployment control |
| `research/` | Chỗ dành cho fixture, protocol, phân tích/kết quả; hiện chưa có pipeline hay research notes/bài báo |
| `infra/` | Docker Compose và init SQL PostgreSQL/pgvector |
| `docs/` | Yêu cầu, kiến trúc, đánh giá, lộ trình và trạng thái có bằng chứng |

Giữ ranh giới LLM/embedding adapter, storage/matching/validation, admission/TTL/eviction/invalidation và provenance/version. None/local/server và exact/semantic vẫn là khả năng thiết kế; server storage chưa chốt, hai tầng/fine-tune/FL để sau. Không đổi package/repository/path hoặc xây lại frontend trong đợt cập nhật này.

## Chạy và kiểm tra

Từ thư mục gốc, mở từng terminal PowerShell:

```powershell
cd frontend
npm ci
npm run dev
```

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend: http://127.0.0.1:3000; bản xem trước mới: http://127.0.0.1:3000/workspace. Health: http://127.0.0.1:8000/health. UI mô phỏng không cần API key/database. Các lệnh chưa chạy workflow báo giá/Agent thật. Xem [setup](docs/general/setup.md) cho yêu cầu môi trường, Compose và các lệnh lint/typecheck/test/build/browser smoke.

## Tài liệu và bước tiếp theo

- [Tổng quan/yêu cầu/câu hỏi mở](docs/general/overview.md): ràng buộc giảng viên, định nghĩa nghiệp vụ và threshold cần xác nhận.
- [Kiến trúc](docs/system/architecture.md), [cache](docs/system/cache.md), [bảo mật và approval gate](docs/system/authorization.md).
- [Tổ chức source và đặt tên](docs/system/code-organization.md): frontend theo component/feature, backend theo domain/adapter và UI template source theo tên component.
- [Frontend hiện tại và phương án tái sử dụng](docs/frontend/design.md), [thiết kế đánh giá](docs/evaluation/design.md).
- [Kế hoạch PoC](docs/general/implementation-plan.md): đã bắt đầu code nền kết nối DB/readiness; schema, app và workflow triển khai theo điều kiện của từng gói.
- [Trạng thái kiểm chứng](docs/general/project-status.md), [mục lục docs](docs/README.md), [quy tắc cho agent](AGENTS.md).
