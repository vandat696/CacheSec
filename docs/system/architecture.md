# Kiến trúc hệ thống

## Phạm vi và trạng thái

Kiến trúc nghiên cứu là Secure Local Semantic Cache; bối cảnh mục tiêu là AI-assisted software development trong [kịch bản báo giá duy nhất](../general/overview.md). Các phần Target dưới đây là **thiết kế, chưa triển khai**. Không dùng tài liệu này làm bằng chứng Agent/cache/gate đã hoạt động.

## As-Is Architecture — khảo sát 2026-11-02

| Phần hiện có | Bằng chứng trong repo | Hành vi/giới hạn |
| --- | --- | --- |
| Next.js App Router | [layout](../../frontend/src/app/layout.tsx), [app shell](../../frontend/src/components/layout/app-shell.tsx) | Bốn khu Thiết lập/Chat/Số liệu/Tài liệu; providers giữ bộ nhớ phiên, chưa nối API nghiệp vụ |
| Chat | [use-chat](../../frontend/src/features/chat/use-chat.ts), [demo-reply](../../frontend/src/features/chat/demo-reply.ts) | Hai nhánh gọi mô phỏng có delay; không LLM, không lookup, không telemetry thật |
| Số liệu | [metrics-preview](../../frontend/src/features/metrics/metrics-preview.ts), [metrics-model](../../frontend/src/features/metrics/metrics-model.ts) | Fixture UI 24 query hoặc dữ liệu phiên; không kết quả benchmark |
| Thiết lập | [setup-workspace](../../frontend/src/features/setup/setup-workspace.tsx), [workspace-model](../../frontend/src/features/workspace/workspace-model.ts) | Validation/snapshot/JSON results null; không runner hoặc cấp quyền |
| Tài liệu | [document-model](../../frontend/src/features/documents/document-model.ts), [provider](../../frontend/src/features/documents/documents-provider.tsx) | Giữ File/metadata trong phiên; không đọc/upload/index |
| FastAPI | [main.py](../../backend/app/main.py), [test health](../../backend/tests/test_health.py) | Chỉ GET /health xác nhận process liveness và CORS local; không auth/DB/model |
| PostgreSQL/pgvector | [compose](../../infra/compose.yaml), [init SQL](../../infra/init.sql) | Cấu hình hạ tầng, chưa schema/adapter/migration hoặc kiểm chứng DB trong lượt khảo sát |
| Research | `research/datasets/`, `research/results/` | Chỗ dành sẵn; không có fixture báo giá, protocol chạy hoặc ghi chú bài báo được tìm thấy |

Trong code hiện tại không có IndexedDB/Dexie, matching/verification, Agent adapter, patch executor hoặc approval/deployment gate. Sau khảo sát tài liệu, đã thêm `/workspace` xem trước với diff/test/approval/nhật ký UI mô phỏng trong `frontend/src/features/developer/`; chưa đọc repo, chạy test nghiệp vụ, xác thực reviewer, tạo artifact hoặc audit log backend. Xem [frontend](../frontend/design.md) cho hành vi bản mẫu và [project status](../general/project-status.md) cho mốc kiểm chứng. Bảng khảo sát ban đầu bên trên ghi bốn màn cũ; điều hướng hiện tại thêm Workspace đứng đầu.

## Target Architecture — ba ranh giới chính, một repository

| Thành phần | Trách nhiệm mục tiêu |
| --- | --- |
| Supplier Quotation Management | App nghiệp vụ tối giản, hàng đợi báo giá giả lập, source thật; baseline chưa có rule mới. Fixture/test chỉ thuộc một nhiệm vụ, không dựng ERP |
| CacheSec Developer Workspace | Request, context có provenance, diff, test, review, approval và trace; tái sử dụng frontend hiện có |
| Local Semantic Cache | Answer Cache cục bộ trước; Context Cache mở rộng. Storage/matching/validation tách trách nhiệm; không lưu approval để tự cấp phép |
| Trusted backend | Identity/tenant/repo và quyền hiện tại, registry provenance/integrity, cache verification, admission và invalidation |
| Authorized Repository Retrieval/RAG | Chỉ đọc snapshot/file được phép; index/chunk/vector gắn revision/hash. Upload tài liệu nội bộ cũ không phải bước bắt buộc của PoC mới |
| LLM/embedding/Agent adapters | API trước, local sau; LLM và embedding độc lập. Agent dùng context đã xác minh tạo patch qua công cụ có scope |
| Test executor | Chạy code/test thật trên một fixture đóng băng, lưu kết quả gắn patch/source/artifact; không nhận lệnh bất kỳ từ UI |
| Human Approval & Deployment Control | Một implementation chung cho hai workflow; duyệt exact change, kiểm tra đúng artifact và quyền tại deployment |
| Trace & Evaluation | Sự kiện liên kết xuyên workflow, năm chiều đo chính và chỉ số cache riêng; runner không phụ thuộc UI demo |

Giữ Next.js → FastAPI qua HTTP; PostgreSQL/pgvector dự kiến lưu metadata/vector được phép; TypeScript/IndexedDB/Dexie dự kiến lưu local browser cache. Vị trí local còn cần xác nhận khi chọn Agent integration; không tự chuyển sang agent-side disk cache hoặc thêm dịch vụ. Server cache vẫn là đối chiếu mở rộng, storage chưa chốt. Không yêu cầu mỗi trách nhiệm là microservice/class riêng.

### Quy tắc độc lập giữa ứng dụng, Agent/IDE và cache

Đã thống nhất theo yêu cầu người dùng ngày 2026-11-07; đây là **quy tắc thiết kế, chưa được triển khai**. Tách cả source ứng dụng mục tiêu, không chỉ dữ liệu hoặc màn hình. Giữ một repository cho PoC, với ba ranh giới:

| Ranh giới | Sở hữu | Hướng phụ thuộc |
| --- | --- | --- |
| Ứng dụng báo giá | Source nghiệp vụ, API/giao diện báo giá và test của ứng dụng | Chạy được độc lập; không import lõi cache hoặc code điều phối Agent/IDE để thực hiện validation |
| Agent/IDE và control | UI code/chat, điều phối model/tools, repository adapter, proposal, test executor, approval/deployment và trace | Coi source báo giá là repository mục tiêu được cấp scope; tích hợp cache qua contract/adapter, không import nghiệp vụ để sửa hay chạy trực tiếp trong process control |
| Lõi cache | Storage/matching/validation, metadata/provenance và lifecycle tái sử dụng | Không import model/schema nghiệp vụ báo giá hoặc phụ thuộc một Agent/IDE cụ thể; dùng adapter storage/embedding và contract xác minh nguồn/quyền |

Agent/IDE có thể được thay bằng host tích hợp khác; ứng dụng báo giá có thể được thay bằng repo mục tiêu khác mà không sửa thuật toán lõi cache chỉ để đổi nghiệp vụ. Khả năng tái sử dụng này là yêu cầu kiến trúc, chưa phải bằng chứng đã tương thích với IDE/Agent bên ngoài. Adapter theo host chịu trách nhiệm ánh xạ context, identity/tenant/repo/scope, mọi nguồn phụ thuộc và phiên bản cấu hình. Contract xác minh phải dựa trên backend/provider đáng tin cậy; cache không nhận metadata tự khai làm quyền, không xác minh được thì không trả payload. Chi tiết API, packaging và vị trí local vẫn chưa chốt; không dựng plugin framework hoặc service riêng chỉ để tạo ranh giới.

Runtime báo giá và việc chạy bản sửa/test phải tách khỏi process control. Agent chỉ sửa source ứng dụng trong scope đã cấp; không được sửa code cache, gate hoặc policy của control để hoàn thành nhiệm vụ. Bản đề xuất được lưu riêng, diff UI phản ánh đúng bản đó; chỉ artifact đúng phiên bản/hash đã qua approval gate mới được kích hoạt cho runtime báo giá. Hiển thị hoặc sửa văn bản trên web không tự thay code đang chạy. Cơ chế sandbox, quyền executor và deploy target vẫn cần chốt theo [ranh giới tin cậy](authorization.md).

Dữ liệu báo giá, cache entries/vector và proposal/test/approval thuộc các chủ sở hữu riêng. Có thể tổ chức bảng/schema riêng trên cùng hạ tầng khi phù hợp; không bắt buộc database hay Git repository riêng cho mỗi thành phần hoặc mỗi revision. Không đọc chéo bảng nội bộ để bỏ qua contract. Server cache storage chưa chốt; cache không lưu approval để cấp quyền. Các lượt thực nghiệm vẫn dùng cùng fixture cố định và quy trình reset đã khóa.

## Luồng mục tiêu tám bước

```mermaid
flowchart TD
    A[1. Developer Request] --> B[2. Local Cache Lookup]
    B --> C[3. Authorization & Cache Verification]
    C -->|Safe Hit| E[5. AI Coding Agent]
    C -->|Miss hoặc Rejected| D[4. Authorized Repository Retrieval]
    D --> E
    E --> F[6. Testing trên fixture cố định]
    F --> G[7. Human Approval Gate cho exact change]
    G -->|Hợp lệ, đúng artifact| H[8. Deployment & Audit]
    G -->|Thiếu duyệt, sai quyền hoặc mã đổi| I[Block deployment và ghi lý do]
```

1. **Developer Request:** xác định identity/tenant/repo, snapshot gốc, request/task ID và đúng yêu cầu ngày hết hạn. Phân biệt câu hỏi tìm hiểu repo với yêu cầu thực thi thay đổi.
2. **Local Lookup:** chỉ tìm candidate trong namespace/scopes được phép; embedding nếu cần. Chưa tìm được candidate là Miss, chưa được xem là Hit.
3. **Authorization & Verification:** backend đối chiếu metadata tin cậy và nội dung, quyền hiện tại, ngữ nghĩa/intent, phạm vi context, mọi nguồn/hash/version, freshness/TTL/policy/config. Safe Hit chỉ khi tất cả đạt; client không tự khai ALLOW. [Cache flow](cache.md) sở hữu chi tiết.
4. **Authorized Retrieval:** Miss/Rejected đi vào retrieval có phân quyền; source không được phép hoặc verifier không khả dụng không dẫn tới truy xuất rộng hơn. Ghi provenance của context mới; có thể gọi LLM trả lời câu hỏi và admission nếu đủ điều kiện.
5. **AI Agent:** dùng context đúng snapshot tìm vị trí và tạo patch cho một rule. Answer Cache có thể tránh sinh lại câu trả lời tra cứu; yêu cầu tạo patch vẫn cần Agent/LLM nếu không có cơ chế khác được kiểm chứng. Không tự chạy cached patch/approval. Trước sửa, đối chiếu source thực tế với snapshot; mã đổi thì đọc/xác minh lại.
6. **Testing:** kiểm thử validation, hồi quy và gate trên fixture đã khóa. Lưu stdout/stderr đã lọc, pass/fail/error/timeout, source/patch/artifact/test/fixture/config hashes. Test pass không phải approval. Test fail đưa về sửa đúng nhiệm vụ và chạy lại, không tự deploy.
7. **Human Approval:** người có thẩm quyền xem diff chính xác và kết quả test; backend ghi quyết định tường minh gắn exact change. Từ chối/thiếu duyệt/sai quyền/đổi patch hoặc artifact chặn deployment; mã đổi cần test và approval mới. Self-approval và thời hạn duyệt còn mở.
8. **Deployment & Audit:** control kiểm tra lại quyền, approval còn hiệu lực và binding của đúng artifact; chỉ kích hoạt artifact bất biến đã duyệt, ghi deployed/blocked/failed. Không rebuild một artifact khác sau approval rồi coi là đã duyệt. Đây là control PoC dự kiến, chưa có deploy thật.

Với câu hỏi tra cứu thuần túy, Safe Hit có thể kết thúc bằng answer thay vì đi tiếp tạo patch. Sơ đồ mô tả workflow thay đổi code; không buộc mỗi query tìm hiểu repo đều phải deploy.

## Authorization, approval và ranh giới tin cậy

Browser và nội dung repository/LLM không có thẩm quyền cấp quyền hoặc duyệt. Backend giữ identity/policy/provenance đáng tin cậy. Cache verification kiểm soát **reuse thông tin**; gate kiểm soát **triển khai thay đổi**. Vai trò, giả mạo cache, source/policy stale, prompt injection từ repo, thu hồi quyền reviewer và TOCTOU thuộc [authorization](authorization.md).

Đề xuất định danh exact change bằng tuple bất biến gồm repo ID, base/source revision, patch digest, artifact digest, fixture/test/config digests. Approval và deployment event cùng tham chiếu tuple; schema và cơ chế hash/chứng thực chưa chốt. Hash client gửi không tự chứng minh artifact đáng tin hoặc đúng quyền.

## Dữ liệu/API và tổ chức dự kiến

API ứng dụng hiện có là **GET /health → {"status":"ok"}**; FastAPI cung cấp OpenAPI UI. Chưa có hợp đồng API mới được chốt. Cần thiết kế request/run, repository snapshot/source provenance, cache entry/verification, change proposal, test execution, approval, artifact và deployment decision với ID/phiên bản/lỗi nhất quán. Không mô tả URL dự kiến như endpoint đang chạy.

Module nghiệp vụ đặt riêng trong `backend/app/`; adapter LLM, embedding và Agent tách khỏi HTTP/storage. `frontend/src/lib/` dự kiến chứa API client/cache khi cần; chưa có implementation hiện tại. App báo giá có thể ở `backend/app/quotation_demo/`, test trong `backend/tests/`, fixture ở `research/datasets/`; cấu trúc cụ thể là đề xuất trong [implementation plan](../general/implementation-plan.md). Vị trí thư mục không cho phép trộn nghiệp vụ với control/cache: khi triển khai phải có entrypoint chạy app độc lập và tuân thủ ba ranh giới bên trên. Backend không phụ thuộc script nghiên cứu; fixture đọc theo contract chung.

Cần chốt tool executor/sandbox và đường deploy PoC trước cấp quyền Agent. Mọi read/write/test nằm trong repo/scope đã cấp; source repo là dữ liệu, chỉ dẫn trong source không được đổi policy/control. Ưu tiên module nhỏ, không tự thêm SDK/dịch vụ/framework.
