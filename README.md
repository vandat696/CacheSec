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

Máy dev đã cấu hình: bật Docker Desktop rồi chạy `npm --prefix frontend run local` để mở stack; Workspace và Báo giá tự kết nối, không dán token. Đổi giữa hai trang giữ bản sửa và báo giá đang chọn, không nhập lại ID. Nếu dịch vụ đang chạy, `npm --prefix frontend run workspace` chỉ mở project. Phiên local tối đa 8 giờ; [hướng dẫn](docs/general/setup.md#mở-toàn-bộ-stack-local-bằng-một-lệnh) có tùy chọn Studio và giới hạn.

Bối cảnh đã cập nhật ngày **2026-11-02**. Frontend có thêm **Developer Workspace tại `/workspace`** để xem thử workflow mới; các màn chatbot nội bộ cũ tiếp tục được giữ để tái sử dụng.

| Thành phần | Hiện có | Giới hạn |
| --- | --- | --- |
| Workspace `/workspace` | Editor/revision/diff/test Docker và khung Agent Gemini 3.5 Flash-Lite | Model cần key private; chỉ đề xuất file validation, người dùng áp dụng/test; chưa cache/Agent tự trị/gate |
| Thiết lập `/setup` | Chín nhóm mode/dataset/embedding/threshold/eviction/quyền/training/logging/export; snapshot trong phiên, validation và xuất JSON cấu hình | Bản nháp; results null, chưa áp dụng vào Chat hoặc chạy benchmark/training/logging thật |
| Chat `/` | Lịch sử, bản nháp, Không cache/Cache/Cả hai với prompt chung; modal thông số từng lượt | Phản hồi mô phỏng, chưa AI/RAG hoặc cache thật |
| Số liệu `/metrics` | Ba tab, biểu đồ/bảng/chi tiết; mặc định 24 truy vấn giả, nguồn phiên riêng tại `/metrics?source=session` | Fixture xem UI, không phải kết quả thực nghiệm |
| Tài liệu `/documents` | Chọn/thả, phân loại, tìm/lọc tệp trong phiên | Chờ tải lên; chưa đọc/ingest/upload hoặc authorized retrieval |
| Backend control | Health/readiness, blob/registry/snapshot và API revision/test với quyền hiện tại; worker Docker riêng | Dev có read/propose/test; chưa review/deploy; readiness chỉ kiểm PostgreSQL |
| Báo giá `/quotations` | Form nhập, danh sách/chi tiết và validation nền nối API/PostgreSQL thật; Bearer fixture reader/operator, retry idempotent | Một dataset dùng chung; validator nền chưa có quy tắc nghiệp vụ, chưa rule ngày hoặc artifact/gate |
| Hạ tầng | PostgreSQL 17.11/pgvector 0.8.7 qua Compose; đã áp dụng migration báo giá và kiểm chứng DB thật | Control có index blob thô; chưa schema approval/deployment hoặc artifact-ready |

App báo giá chạy HTTP độc lập với quyền fixture được backend kiểm tra tại /quotations. Control HTTP lấy scope từ principal và kiểm quyền hiện tại theo tenant/repo; profile dev giữ ba file business, dev có read/propose/test. API chạy bằng Docker local vì DLL psycopg Windows bị chặn. [Setup](docs/general/setup.md#2e-control-dev-trong-docker-khi-python-windows-bị-chặn) có hướng dẫn; [Agent Gemini](docs/general/setup.md#agent-gemini) dùng key private và generation adapter riêng, cần key hợp lệ để gọi model. Chưa fixture báo giá đóng băng, Local Semantic Cache/embedding/matching/verification, Agent tự trị, approval/deployment control, audit nghiên cứu đầy đủ hoặc runner. Review/Phê duyệt/Nhật ký mẫu giữ trong trang UI phụ, không phải bằng chứng quyền. Hội thoại/draft mất khi reload; UI không tự cấp quyền.

Đã có [luồng sửa/test kỹ thuật T12](docs/system/change-workflow.md) từ Workspace tới Docker/DB test cô lập. Test pass không cấp quyền triển khai hoặc chứng minh correctness của rule ngày; chưa có binding ready cho gate.

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
.\.venv\Scripts\python.exe -m uvicorn app.control.control_api:app --reload --host 127.0.0.1 --port 8000
```

Frontend: http://127.0.0.1:3000; bản xem trước mới: http://127.0.0.1:3000/workspace. Health: http://127.0.0.1:8000/health. UI mô phỏng không cần API key/database. API báo giá dùng factory app.quotation_demo.quotation_api:create_app --factory, cổng 8001 sau migration và cấu hình token; [setup](docs/general/setup.md#2b-api-báo-giá-độc-lập) có lệnh đầy đủ. Chưa chạy Agent/cache/gate; setup cũng chứa lệnh kiểm tra.

Xem database trên web: sau npm ci và cấu hình QUOTATION_DATABASE_URL trong backend/.env, chạy `npm --prefix frontend run db:studio` từ thư mục gốc, mở http://localhost:5555. [Prisma Studio local](docs/general/setup.md#xem-database-bằng-prisma-studio) dùng trực tiếp PostgreSQL; migration/ứng dụng vẫn thuộc backend Python.

## Tài liệu và bước tiếp theo

- [Tổng quan/yêu cầu/câu hỏi mở](docs/general/overview.md): ràng buộc giảng viên, định nghĩa nghiệp vụ và threshold cần xác nhận.
- [Kiến trúc](docs/system/architecture.md), [cache](docs/system/cache.md), [bảo mật và approval gate](docs/system/authorization.md).
- [Tổ chức source và đặt tên](docs/system/code-organization.md): frontend theo component/feature, backend theo domain/adapter và UI template source theo tên component.
- [Frontend hiện tại và phương án tái sử dụng](docs/frontend/design.md), [thiết kế đánh giá](docs/evaluation/design.md).
- [Kế hoạch PoC](docs/general/implementation-plan.md): đã có nền DB và API báo giá với quyền fixture; validation/fixture và control/workflow tiếp tục theo điều kiện từng gói.
- [Trạng thái kiểm chứng](docs/general/project-status.md), [mục lục docs](docs/README.md), [quy tắc cho agent](AGENTS.md).
