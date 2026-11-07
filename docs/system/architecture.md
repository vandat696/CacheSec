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
| Local Semantic Cache | Repository Context Cache trong trình duyệt/web Workspace trước theo lựa chọn người dùng 2026-11-07; Answer Cache mở rộng. Storage/matching/validation tách trách nhiệm; không lưu approval để tự cấp phép |
| Trusted backend | Identity/tenant/repo và quyền hiện tại, registry provenance/integrity, cache verification, admission và invalidation |
| Authorized Repository Retrieval/RAG | Chỉ đọc snapshot/file được phép; index/chunk/vector gắn revision/hash. Upload tài liệu nội bộ cũ không phải bước bắt buộc của PoC mới |
| LLM/embedding/Agent adapters | API trước, local sau; LLM và embedding độc lập. Agent dùng context đã xác minh tạo patch qua công cụ có scope |
| Test executor | Chạy code/test thật trên một fixture đóng băng, lưu kết quả gắn patch/source/artifact; không nhận lệnh bất kỳ từ UI |
| Human Approval & Deployment Control | Một implementation chung cho hai workflow; duyệt exact change, kiểm tra đúng artifact và quyền tại deployment |
| Trace & Evaluation | Sự kiện liên kết xuyên workflow, năm chiều đo chính và chỉ số cache riêng; runner không phụ thuộc UI demo |

Giữ Next.js → FastAPI qua HTTP; PostgreSQL dự kiến cho metadata/control và pgvector khi retrieval/index cần. Người dùng đã chọn browser Context Cache cho web Workspace trước; TypeScript/IndexedDB/Dexie là hướng dự kiến, engine/schema cụ thể chưa chốt. Browser chỉ tìm/lưu candidate, backend xác minh nội dung/provenance/quyền/nguồn hiện tại trước khi Agent dùng context; không tin metadata/Hit do client tự khai. LLM vẫn xử lý request sau Context Hit. Vị trí storage cho adapter IDE về sau cần xác nhận riêng; server cache vẫn là đối chiếu mở rộng chưa chốt storage. Không yêu cầu mỗi trách nhiệm là microservice/class riêng hoặc sao chép cache/vector lên server chỉ vì đã có PostgreSQL/pgvector.

### Quy tắc độc lập giữa ứng dụng, Agent/IDE và cache

Đã thống nhất theo yêu cầu người dùng ngày 2026-11-07; đây là **quy tắc thiết kế, chưa được triển khai**. Tách cả source ứng dụng mục tiêu, không chỉ dữ liệu hoặc màn hình. Giữ một repository cho PoC, với ba ranh giới:

| Ranh giới | Sở hữu | Hướng phụ thuộc |
| --- | --- | --- |
| Ứng dụng báo giá | Source nghiệp vụ, API/giao diện báo giá và test của ứng dụng | Chạy được độc lập; không import lõi cache hoặc code điều phối Agent/IDE để thực hiện validation |
| Agent/IDE và control | UI code/chat, điều phối model/tools, repository adapter, proposal, test executor, approval/deployment và trace | Coi source báo giá là repository mục tiêu được cấp scope; tích hợp cache qua contract/adapter, không import nghiệp vụ để sửa hay chạy trực tiếp trong process control |
| Lõi cache | Storage/matching/validation, metadata/provenance và lifecycle tái sử dụng | Không import model/schema nghiệp vụ báo giá hoặc phụ thuộc một Agent/IDE cụ thể; dùng adapter storage/embedding và contract xác minh nguồn/quyền |

Agent/IDE có thể được thay bằng host tích hợp khác; ứng dụng báo giá có thể được thay bằng repo mục tiêu khác mà không sửa thuật toán lõi cache chỉ để đổi nghiệp vụ. Khả năng tái sử dụng này là yêu cầu kiến trúc, chưa phải bằng chứng đã tương thích với IDE/Agent bên ngoài. Adapter theo host chịu trách nhiệm ánh xạ context, identity/tenant/repo/scope, mọi nguồn phụ thuộc và phiên bản cấu hình. Contract xác minh phải dựa trên backend/provider đáng tin cậy; cache không nhận metadata tự khai làm quyền, không xác minh được thì không trả payload. Chi tiết API/packaging còn mở; vị trí local đã chọn browser cho PoC đầu, chưa chọn cho adapter ngoài. Không dựng plugin framework hoặc service riêng chỉ để tạo ranh giới.

Runtime báo giá và việc chạy bản sửa/test phải tách khỏi process control. Agent chỉ sửa source ứng dụng trong scope đã cấp; không được sửa code cache, gate hoặc policy của control để hoàn thành nhiệm vụ. Bản đề xuất được lưu riêng, diff UI phản ánh đúng bản đó; chỉ artifact đúng phiên bản/hash đã qua approval gate mới được kích hoạt cho runtime báo giá. Hiển thị hoặc sửa văn bản trên web không tự thay code đang chạy. Cơ chế sandbox, quyền executor và deploy target vẫn cần chốt theo [ranh giới tin cậy](authorization.md).

Dữ liệu báo giá, cache entries/vector và proposal/test/approval thuộc các chủ sở hữu riêng. Có thể tổ chức bảng/schema riêng trên cùng hạ tầng khi phù hợp; không bắt buộc database hay Git repository riêng cho mỗi thành phần hoặc mỗi revision. Không đọc chéo bảng nội bộ để bỏ qua contract. Server cache storage chưa chốt; cache không lưu approval để cấp quyền. Các lượt thực nghiệm vẫn dùng cùng fixture cố định và quy trình reset đã khóa.

### Tích hợp CacheSec vào IDE và Agent

Theo yêu cầu người dùng ngày 2026-11-07, mục tiêu là Developer có thể dùng cache trong IDE/Agent được hỗ trợ, không phải chuyển sang web Workspace hoặc chạy kèm ứng dụng báo giá. Web Workspace là một host sử dụng cùng contract; VS Code là ví dụ host mở rộng, chưa có extension/SDK hoặc adapter bên ngoài hoạt động.

Contract chung phải có phiên bản và được tài liệu hóa để Developer viết tích hợp; bao phủ lookup, admission/lưu, xác minh và invalidation theo [thiết kế cache](cache.md). Có thể cung cấp qua SDK nhúng trong host hoặc API qua adapter khi cần; chưa chốt hình thức đóng gói, transport hay dịch vụ triển khai. Browser local là lựa chọn cho web PoC, không buộc mọi adapter ngoài dùng browser session, UI web, API nội bộ của một IDE hoặc một model provider.

Adapter IDE/Agent nối vào bước lấy ngữ cảnh hoặc câu trả lời của Agent, chuyển đổi request/provenance và cấu hình theo contract; authority và nguồn hiện tại vẫn phải được backend/provider tin cậy xác minh. Bật/tắt cache chỉ thay đường reuse, không bỏ authorization, test hoặc approval gate. Cài extension riêng không tự khiến mọi Agent/extension khác gọi cache; phải có điểm tích hợp với Agent tương ứng. Chỉ công bố hỗ trợ tổ hợp host/Agent/adapter đã kiểm chứng, gồm đường Hit/Miss/Rejected, lỗi xác minh và nguồn/quyền thay đổi; không suy ra tương thích mọi IDE từ contract chung.

Trải nghiệm mục tiêu là cài adapter phù hợp, cấu hình/xác thực, chọn workspace/repo được phép rồi làm việc với Agent như thường; trạng thái cache ngắn và chi tiết mở khi cần. PoC vẫn ưu tiên một đường tích hợp trong kịch bản đã khóa; hỗ trợ nhiều IDE là hướng mở rộng, không thêm workload/fixture hoặc biến việc phát triển extension thành thay đổi phần mềm thứ hai trong thí nghiệm. Hiện chỉ chốt quy tắc thiết kế này; contract cụ thể và adapter đầu tiên còn cần chọn trước triển khai.

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
5. **AI Agent:** dùng context đúng snapshot tìm vị trí và tạo patch cho một rule. Với Context Cache đã chọn, Hit cung cấp ngữ cảnh xác minh để LLM tiếp tục xử lý, không tự tránh lần gọi model hoặc chứng minh tiết kiệm token. Answer Cache về sau có thể tránh sinh lại answer tra cứu nhưng không tự hoàn thành patch. Không tự chạy cached patch/approval. Trước sửa, đối chiếu source thực tế với snapshot; mã đổi thì đọc/xác minh lại.
6. **Testing:** kiểm thử validation, hồi quy và gate trên fixture đã khóa. Lưu stdout/stderr đã lọc, pass/fail/error/timeout, source/patch/artifact/test/fixture/config hashes. Test pass không phải approval. Test fail đưa về sửa đúng nhiệm vụ và chạy lại, không tự deploy.
7. **Human Approval:** người có thẩm quyền xem diff chính xác và kết quả test; backend ghi quyết định tường minh gắn exact change. Từ chối/thiếu duyệt/sai quyền/đổi patch hoặc artifact chặn deployment; mã đổi cần test và approval mới. Self-approval và thời hạn duyệt còn mở.
8. **Deployment & Audit:** control kiểm tra lại quyền, approval còn hiệu lực và binding của đúng artifact; chỉ kích hoạt artifact bất biến đã duyệt, ghi deployed/blocked/failed. Không rebuild một artifact khác sau approval rồi coi là đã duyệt. Đây là control PoC dự kiến, chưa có deploy thật.

Với câu hỏi tra cứu thuần túy, Safe Hit có thể kết thúc bằng answer thay vì đi tiếp tạo patch. Sơ đồ mô tả workflow thay đổi code; không buộc mỗi query tìm hiểu repo đều phải deploy.

## Authorization, approval và ranh giới tin cậy

Browser và nội dung repository/LLM không có thẩm quyền cấp quyền hoặc duyệt. Backend giữ identity/policy/provenance đáng tin cậy. Cache verification kiểm soát **reuse thông tin**; gate kiểm soát **triển khai thay đổi**. Vai trò, giả mạo cache, source/policy stale, prompt injection từ repo, thu hồi quyền reviewer và TOCTOU thuộc [authorization](authorization.md).

Đề xuất định danh exact change bằng tuple bất biến gồm repo ID, base/source revision, patch digest, artifact digest, fixture/test/config digests. Approval và deployment event cùng tham chiếu tuple; schema và cơ chế hash/chứng thực chưa chốt. Hash client gửi không tự chứng minh artifact đáng tin hoặc đúng quyền.

## Dữ liệu/API và tổ chức dự kiến

API ứng dụng hiện có là **GET /health → {"status":"ok"}**; FastAPI cung cấp OpenAPI UI. Chưa có hợp đồng API mới được chốt. Cần thiết kế request/run, repository snapshot/source provenance, cache entry/verification, change proposal, test execution, approval, artifact và deployment decision với ID/phiên bản/lỗi nhất quán. Không mô tả URL dự kiến như endpoint đang chạy.

### Bản nháp T02: module và contract

Soạn ngày 2026-11-07 từ đầu vào kỹ thuật T01 đã được người dùng chọn; **chưa khóa contract hoặc triển khai endpoint**. Bộ sáu trường báo giá, rule ngày, Context Cache/browser, identity fixture và self-approval có quyền Reviewer theo [overview](../general/overview.md#hồ-sơ-đầu-vào-t01--đang-thực-hiện). Acceptance nghiên cứu chờ cô quy định; không đưa giá trị mặc định 100% vào API hoặc dùng nó để quyết định một run đã đạt nghiệm thu.

#### Module và hướng gọi

| Module/trách nhiệm dự kiến | Sở hữu dữ liệu/hành vi | Giao tiếp |
| --- | --- | --- |
| Ứng dụng báo giá độc lập | Sáu trường nghiệp vụ, validation nền, API báo giá và runtime artifact đang hoạt động | Web báo giá gọi API app; control quản lý activation qua launcher/adapter, không import nghiệp vụ vào process control |
| Identity và scope | Principal fixture backend quản lý, capability theo tenant/repo/action | Các thao tác control/retrieval/verification/gate phải kiểm tra quyền hiện tại; UI không tự cấp role |
| Repository/context | Repo allowlist, snapshot/file hashes, retrieval được phép và dependency manifest | Workflow gọi adapter đọc nguồn trong scope; không cung cấp API đọc path bất kỳ trên máy |
| Workflow/proposal | Request/run, source/diff/revision, test/artifact references, trạng thái và event links | Điều phối generation, executor, quyết định người dùng và gate; không trộn object báo giá vào lõi cache |
| Browser cache và trusted verifier | Candidate/payload local; bằng chứng provenance/integrity và quyền/nguồn do backend xác minh | Browser tìm/lưu candidate qua contract chung; verifier cung cấp context hợp lệ cho workflow, không tin browser báo Hit |
| Generation và embedding adapters | Request/response model, usage/error/duration và cấu hình có phiên bản | Workflow dùng generation; matching dùng embedding khi cần, không gắn cố định provider vào storage |
| Executor và deployment control | Bản làm việc riêng, test evidence, artifact bất biến, approval binding và activation | Chạy ngoài process control theo sandbox/allowlist chốt tại T04; mọi activation rule mới đi qua cùng gate |

Đây là ranh giới trách nhiệm, không phải yêu cầu tạo một microservice/class cho mỗi hàng. Tên thư mục/entrypoint cụ thể và các kiểu dữ liệu sẽ hoàn thiện trong T02–T03 trước khi tạo source mới.

#### Bề mặt API đề xuất

App báo giá và control có base URL/entrypoint riêng. Các đường dẫn dưới đây là bản nháp; không phải route đang chạy, chưa chốt transport/SDK cho lõi cache. HTTP adapter không được trở thành dependency của logic nghiệp vụ hoặc matching.

| API/thao tác dự kiến | Đầu vào và đầu ra chính | Kiểm soát bắt buộc |
| --- | --- | --- |
| App: POST/GET /quotations, GET /quotations/{id} | Tạo, liệt kê và xem sáu trường; ID do app quản lý | Validation nền riêng; giữ missing/null/raw của ngày theo contract, không bổ sung trước rule mới |
| App: POST /quotations/{id}/validate | Trả flags, reference_date và active_artifact reference | Kết quả từ code runtime đang chạy; client không gửi flags làm kết quả tin cậy; R fixture cố định, chính sách R ngoài fixture còn cần đặc tả |
| Control: GET /session, GET /repositories/{id}/snapshot | Principal/capability thực tế trong fixture và snapshot nguồn được phép | Backend cấp identity/scope và đọc nguồn hiện tại; mọi ID/hash từ client chỉ là yêu cầu/tham chiếu cần kiểm tra |
| Control: POST /runs; GET /runs/{id}, GET /runs/{id}/events | Repo/snapshot reference, prompt/intent, config reference và candidate context nếu có; trả run ID, trạng thái, nội dung/proposal và event cursor | Kiểm tra quyền/intent/snapshot, xác minh candidate trước generation; không candidate thì authorized retrieval. Cache disabled vẫn giữ authorization |
| Control: GET /proposals/{id}, GET /proposals/{id}/diff | Đọc source/diff, base/revision và artifact/evidence references | Nội dung từ snapshot thật; kiểm tra quyền trên dữ liệu trả về, không lấy diff UI làm artifact nguồn |
| Control: POST /proposals/{id}/tests; GET /test-runs/{id} | Suite/config reference và revision; trả job/evidence ID, outcome/usage thực | Không nhận lệnh shell tùy ý; executor chỉ chạy scope/allowlist đã chốt, evidence ràng buộc đúng artifact/fixture |
| Control: POST /proposals/{id}/decisions | Quyết định tường minh, revision, artifact/evidence reference | Principal có quyền Reviewer hiện tại; proposer được trùng reviewer theo policy đã chọn. Agent không có tool gọi thao tác này |
| Control: POST /deployments; GET /deployments/{id} | Artifact/approval/target reference; trả activation hoặc blocked/failed | Capability deploy không tự có từ quyền Reviewer; gate kiểm tra lại đúng bytes/digest và authority/evidence, không rebuild sau duyệt |

Với Context Cache, candidate đính kèm run là đầu vào không tin cậy. Backend phải so payload/provenance với registry/chứng thực và mọi nguồn/quyền hiện tại, rồi mới chuyển context vào LLM. Verifier lỗi không được biến thành ALLOW hoặc truy xuất không hạn chế. TTL/freshness và thời điểm kiểm tra lại khi sử dụng thuộc T04; giá trị cụ thể chưa chốt. Semantic score chỉ phục vụ tìm candidate.

#### Contract cache không phụ thuộc host

| Thao tác logic | Ý nghĩa và ranh giới |
| --- | --- |
| Lookup | Nhận query/intent/context và namespace references; trả candidate IDs/scores từ local store, chưa tuyên bố Safe Hit |
| Verify/resolve | Trusted provider kiểm tra request/payload/dependencies/quyền/config; trả context hợp lệ hoặc lý do từ chối/lỗi theo [cache flow](cache.md#lookup-verification-và-fallback-mục-tiêu) |
| Admit/store | Chỉ ghi context có provenance/integrity và policy đủ điều kiện; không cho client tự chứng thực payload. Kết quả ghi local lỗi phải được báo đúng, không biến thành hit |
| Invalidate/evict | Loại reuse theo namespace/source/policy/TTL/config; eviction quản lý dung lượng, không thay verifier tại lần dùng |

Payload context dự kiến có contract version, entry/context reference, repo/snapshot/dependencies, intent/scope, payload digest, config/embedding namespace và thông tin TTL/freshness đủ xác minh. Trust không đến từ việc client gửi đủ trường. Schema/chứng thực, storage IndexedDB/Dexie và adapter packaging chưa khóa; không có SDK hoặc server cache mới được tạo ở bước này.

#### Trạng thái, retry và lỗi

Run hỏi hiểu repo có thể kết thúc sau retrieval/generation. Run yêu cầu thay đổi phải phân biệt resolving_context, generating/proposal_ready, testing, awaiting_approval, deploying và completed/blocked/failed/timed_out; không coi tạo được diff là đã triển khai. Test/deployment jobs có ID/outcome riêng. Trạng thái thuộc backend, UI chỉ đọc và gửi yêu cầu chuyển trạng thái hợp lệ.

Mỗi bản source/patch/artifact là revision có binding bất biến; sửa bản sau tạo revision mới, vô hiệu test/approval không còn khớp. Approval tham chiếu test evidence bất biến của đúng artifact, không dựa vào tên file/branch hoặc nhãn UI. Trace ghi actor, nguồn/repo, run/proposal/test/approval/artifact/deployment IDs, config và terminal outcome cho đường đã thực thi; không sinh event cache/test/deploy giả cho đường không đi qua.

Đề xuất dùng idempotency key cho tạo job/decision/activation, gắn principal/scope và request fingerprint: retry cùng request trả lại tham chiếu/outcome cũ, key trùng nhưng nội dung khác phải báo conflict; vẫn kiểm tra quyền hiện tại trước trả dữ liệu. Lỗi có code, message ngắn, request/run reference và details được phép lộ. Phân biệt validation, deny, stale/conflict, upstream/model error, timeout và storage/executor error; không trả fixture mẫu để che lỗi thật. HTTP codes, event cursor, giới hạn payload và cancellation sẽ khóa khi hoàn thiện T02/T04.

T02 chưa hoàn thành: cần cụ thể hóa request/response types, operation permissions và các transition hợp lệ, rồi đối chiếu ERD T03/control T04. Một-manifest fixture/oracle, protocol baseline/số lặp và acceptance vẫn chờ xác nhận; các giá trị này không được lấp bằng giả định trong contract.

Module nghiệp vụ đặt riêng trong `backend/app/`; adapter LLM, embedding và Agent tách khỏi HTTP/storage. `frontend/src/lib/` dự kiến chứa API client/cache khi cần; chưa có implementation hiện tại. App báo giá có thể ở `backend/app/quotation_demo/`, test trong `backend/tests/`, fixture ở `research/datasets/`; cấu trúc cụ thể là đề xuất trong [implementation plan](../general/implementation-plan.md). Vị trí thư mục không cho phép trộn nghiệp vụ với control/cache: khi triển khai phải có entrypoint chạy app độc lập và tuân thủ ba ranh giới bên trên. Backend không phụ thuộc script nghiên cứu; fixture đọc theo contract chung.

Cần chốt tool executor/sandbox và đường deploy PoC trước cấp quyền Agent. Mọi read/write/test nằm trong repo/scope đã cấp; source repo là dữ liệu, chỉ dẫn trong source không được đổi policy/control. Ưu tiên module nhỏ, không tự thêm SDK/dịch vụ/framework.
