# Contract backend và cache — T02

## Trạng thái và phạm vi

**Đặc tả T02 v0.2 ngày 2026-11-07; đã triển khai tạo/danh sách/chi tiết và validation nền báo giá, GET /health và GET /ready.** Validation nền chưa có rule ngày; HTTP snapshot/file đã triển khai; revision/test kỹ thuật T12 đã có, các workflow Agent/cache và validation gắn runtime artifact vẫn là thiết kế. API báo giá có entrypoint và quyền fixture riêng, được mô tả bên dưới; [domain/storage](architecture.md#lưu-trữ-báo-giá-đã-triển-khai) có migration riêng. Contract này cụ thể hóa [kiến trúc](architecture.md#bản-nháp-t02-module-và-contract), không phải SDK đã phát hành hoặc workflow Agent đang chạy. Các ví dụ JSON đều là dữ liệu giả minh họa, không phải fixture hoặc kết quả đo.

Đầu vào đã được người dùng chọn nằm tại [hồ sơ T01](../general/overview.md#hồ-sơ-đầu-vào-t01--đang-thực-hiện): sáu trường báo giá; ngày YYYY-MM-DD có thật và d >= 2026-11-07 trong fixture; Context Cache/browser trước; identity fixture backend quản lý; Developer được duyệt nếu có quyền Reviewer hiện tại. Acceptance vẫn chờ cô quy định, không mặc định 100%.

App báo giá và control có entrypoint/base URL riêng. Các route mới dưới đây dùng prefix đề xuất /api/v1; GET /health hiện tại giữ nguyên. Lõi cache chỉ phụ thuộc contract logic; HTTP, browser storage và model provider là adapter. Không tạo service riêng cho mỗi nhóm route.

Danh mục HTTP mô tả host web PoC; tích hợp lõi cache vào Agent/IDE khác không bắt buộc dựng ứng dụng báo giá hoặc toàn bộ WorkflowRun API. Host khác có thể dùng contract context/lookup/verify/admit/invalidate với adapter nguồn/quyền tin cậy tương ứng. Không đưa Quotation hoặc ReviewDecision vào kiểu dữ liệu lõi cache.

Workspace local có adapter phiên ở Next server: `GET/POST/DELETE /api/local-control/session` kiểm phiên, exchange launch capability và logout; proxy `/api/local-control/api/v1/...` chỉ chuyển tiếp allowlist repository và changes read/propose/test đến backend loopback. Đây là transport của web host, không đổi contract Bearer v0.2 hoặc quyền backend. Request cần header/metadata cùng origin, session cookie private và no-store; xem [authorization](authorization.md#phiên-workspace-local). Không có proxy admin/worker/approval/deploy hoặc URL tùy ý.

## Endpoint nền đã triển khai

Luồng revision/test kỹ thuật mới dùng `/api/v1/changes` và private worker channel; route, payload, permission, idempotency và trạng thái thực tế được quản lý tại [workflow T12](change-workflow.md#http-đã-triển-khai). Các API Agent/cache/binding-ready/approval/deployment mục tiêu bên dưới chưa được triển khai bởi mốc này.

Hai endpoint vận hành dùng path trực tiếp, không thuộc /api/v1 và chưa dùng envelope của workflow:

| Method/path | Response | Giới hạn |
| --- | --- | --- |
| GET /health | 200 với {"status":"ok"} | Chỉ process liveness, không mở kết nối DB |
| GET /ready | 200 với {"status":"ready","database":"ready"}; 503 với status = not_ready và database = not_configured/unavailable | Thực hiện PostgreSQL probe mỗi request; không trả DSN, exception hoặc credentials |

/ready hiện chỉ kiểm tra kết nối/truy vấn PostgreSQL, không chứng minh schema, quyền, model, cache hoặc workflow sẵn sàng. Thiếu extension vector không tự làm probe thất bại vì chưa có năng lực runtime cần extension đó. Adapter probe đọc version/extension để kiểm chứng qua test; endpoint không lộ metadata này. Cấu hình timeout và cách chạy ở [setup](../general/setup.md#2-backend).

## Kiểu và quy ước chung

| Kiểu | Định nghĩa dùng trong contract |
| --- | --- |
| Id | Chuỗi opaque do backend cấp; client không phân tích ID thành path/role/quyền |
| Revision | Số nguyên dương tăng khi tạo bản source/patch mới; không cho client ghi đè bản cũ |
| Digest | Chuỗi có tên thuật toán và giá trị digest; blob/control metadata local v0.1 dùng SHA-256 và encoder đã chọn bên dưới; integrity/keys của Context Cache vẫn thuộc T04 và chưa được lựa chọn này chốt thay |
| DecimalString | Chuỗi khớp toàn bộ `[+-]?[0-9]+(\.[0-9]+)?`, không exponent/whitespace/JSON number/NaN/Infinity; giữ nguyên precision và không làm tròn. Không áp min/max/currency theo lựa chọn giữ contract nền ngày 2026-11-09 |
| JsonValue | Giá trị JSON bất kỳ: null, boolean, number, string, array hoặc object; JSON lỗi cú pháp vẫn là request lỗi |
| Timestamp | Thời điểm có offset, đề xuất biểu diễn UTC; tách khỏi ngày nghiệp vụ YYYY-MM-DD. Duration đo bằng đồng hồ đơn điệu, không suy từ hiệu hai máy |
| ConfigRef | ID/version của cấu hình đã đăng ký ở backend, không chứa API key, lệnh shell, raw policy hoặc endpoint provider do client tùy ý nhập |

Request không mang tenant/role/capability/approval state làm authority. API báo giá dùng Bearer fixture và grants tại [authorization](authorization.md#quyền-api-báo-giá-đã-triển-khai); principal/scope do backend gán. Mapping/freshness control/cache và masking theo resource vẫn chờ T04. GET /session bên dưới còn là thiết kế mô tả identity, không phải endpoint đã triển khai hoặc cách cấp quyền.

Response thành công dùng data và meta; meta có contract_version, request_id và các resource references liên quan. Error dùng error.code, error.message, error.details được phép lộ, cùng meta.request_id. Không trả nguyên exception, credential, absolute path hoặc source ngoài quyền trong details. Unknown measurements dùng null/not_applicable và coverage, không gán 0 giả.

## Dữ liệu ứng dụng báo giá

### HTTP báo giá đã triển khai

Entrypoint app.quotation_demo.quotation_api:create_app chạy bằng --factory, độc lập app.control.control_api/control; [cách chạy](../general/setup.md#2b-api-báo-giá-độc-lập). Các thao tác sau kiểm tra token/quyền ở đầu thao tác, trước mở transaction, kể cả replay:

| Method/path | Quyền | Thành công |
| --- | --- | --- |
| POST /api/v1/quotations | quotation.create | 201, data = QuotationRecord; bắt buộc Idempotency-Key |
| GET /api/v1/quotations?limit=50&after=UUID | quotation.read | 200, data = {items, next_cursor}; hết trang next_cursor = null |
| GET /api/v1/quotations/{UUID} | quotation.read | 200, data = QuotationRecord; không thấy trả 404 |
| POST /api/v1/quotations/{UUID}/validate | quotation.read và quotation.validate | 200, data = QuotationValidation nền; không thấy trả 404 sau kiểm quyền |

Response có meta = {contract_version: "v0.2", request_id, identity_mode: "fixture"}. X-Request-ID do backend sinh khớp meta; Cache-Control: no-store. Identity chỉ được kiểm tra cho dữ liệu báo giá; /docs và /openapi.json mở để xem contract, không chứa token/dữ liệu báo giá. Giao diện /quotations đã dùng bốn thao tác này. App bật CORS theo allowlist QUOTATION_CORS_ORIGINS, chỉ GET/POST, nhận Authorization/Content-Type/Idempotency-Key và expose X-Request-ID, không dùng cookie credentials. CORS bọc cả response lỗi; origin được phép vẫn cần Bearer token/quyền.

Theo lựa chọn kỹ thuật của người dùng: body tối đa **65.536 byte (64 KiB)**, đếm cả bytes thực khi không có Content-Length; page limit từ 1 đến **100**, mặc định 50 (hoặc cap cấu hình nếu thấp hơn). Idempotency-Key từ **1–128 ký tự ASCII**, không trim/đổi hoa thường; client nên dùng UUID hoặc chuỗi in được để truyền qua HTTP. Giới hạn này không phải acceptance threshold nghiên cứu. Cấu hình chỉ cho phép hạ cap; không tự mở rộng giới hạn đã chọn.

Idempotency được lưu tại creation_requests, ràng buộc **principal + scope do backend gán + hash key** và hash payload chuẩn hóa. Thứ tự key JSON không ảnh hưởng; missing expires_on khác null, lexeme tiền khác nhau vẫn là payload khác. Cùng key/cùng payload trả lại record đã commit (201); cùng key/khác payload trả 409. PostgreSQL transaction/advisory lock đảm bảo retry song song chỉ tạo một record; tạo báo giá và metadata cùng commit, lỗi commit không trả thành công. Quyền luôn được kiểm tra lại trước lookup replay. Metadata chưa có TTL/GC hoặc API xóa, giữ đến khi có policy lifecycle riêng; hash ở đây dùng đối chiếu retry, không phải chứng thực cache/artifact.

Lỗi của các thao tác dùng error = {code, message} và meta như trên, không echo input/exception/secrets:

| HTTP | Mã/trường hợp |
| --- | --- |
| 400 | INVALID_REQUEST: JSON/schema, UUID/cursor/page/key không hợp lệ hoặc thiếu key |
| 401 | IDENTITY_REQUIRED: thiếu/sai/thu hồi token, kèm WWW-Authenticate: Bearer |
| 403 | ACCESS_DENIED: identity hợp lệ nhưng thiếu capability |
| 404 | QUOTATION_NOT_FOUND: quyền đọc hợp lệ nhưng record không tồn tại |
| 409 | IDEMPOTENCY_CONFLICT: key cũ với payload khác |
| 413 | PAYLOAD_TOO_LARGE: body vượt cap |
| 503 | STORAGE_UNAVAILABLE hoặc AUTHORITY_UNAVAILABLE: dependency không xác minh/thực hiện được |
| 500 | INTERNAL_ERROR: lỗi lập trình không được giả thành lỗi storage hoặc thành công |

Không triển khai update/delete hoặc expiration_review trong lát cắt này. POST tạo hoặc validate thành công không xác nhận ngày hợp lệ, chưa tạo approval hay artifact.

### QuotationCreate và QuotationRecord

| Trường | QuotationCreate | QuotationRecord |
| --- | --- | --- |
| id | Không nhận từ client | Id do app cấp |
| supplier_name | string | string |
| description | string | string |
| total_amount | DecimalString | DecimalString |
| currency | string | string |
| expires_on | JsonValue, có thể thiếu trường | Giữ nguyên thiếu trường/null/giá trị JSON thô |

Năm trường nghiệp vụ được nhận khi tạo; id sinh phía server, nên record có đúng sáu trường đã chọn. Các trường ngoài contract như flags, approved, role hoặc artifact_digest không được nhận để thay kết quả/backend state. Ngày 2026-11-09 người dùng xác nhận **giữ validation nền hiện tại**: supplier_name/description/currency bắt buộc có kiểu chuỗi, có thể rỗng hoặc chỉ chứa khoảng trắng; total_amount bắt buộc theo DecimalString, không ép JSON number thành string. Không thêm tiền dương/min/max, giới hạn nội dung, danh sách hoặc định dạng currency. Body/page/key vẫn chịu các cap đã chọn. Thiếu/sai kiểu hoặc sai cú pháp DecimalString trả 400 INVALID_REQUEST trước mở transaction; đầu vào hợp lệ giữ nguyên nội dung/precision.

expires_on không khai báo như một date đã parse tại HTTP/storage boundary. Thiếu trường khác null, khác chuỗi rỗng; không tự chuyển tất cả về null. Kiểu dữ liệu sai vẫn được giữ để validator xử lý khi ca đó thuộc fixture. Việc POST thành công chỉ xác nhận tiếp nhận record, không khẳng định ngày hợp lệ hoặc báo giá đã được phê duyệt.

Parse của rule mới **được người dùng xác nhận ngày 2026-11-09 ở mức đặc tả**: chỉ chuỗi đúng YYYY-MM-DD và là ngày tồn tại được chuyển thành d; không trim khoảng trắng, ép kiểu JSON hoặc chấp nhận timestamp như date. Missing/null/rỗng/sai kiểu/sai định dạng/ngày không tồn tại hoặc d trước R cần cờ expiration_review sau khi rule được bổ sung. R fixture = 2026-11-07; ngày bằng/sau R không thêm cờ này. Chính sách cung cấp R ngoài fixture còn mở; client không được tùy ý đổi R của lượt thực nghiệm. [Bảng oracle T07](../evaluation/design.md#bảng-oracle-t07-để-review) còn cần review trước tạo/đóng băng fixture; xác nhận parse không có nghĩa duyệt nhãn hoặc cài rule vào app nền.

App nền chưa có rule mới phải tiếp nhận các đầu vào ngày tương tự; không cài trước việc kiểm tra expires_on dưới tên schema validation. JSON/mức payload không hợp lệ vẫn bị từ chối theo giới hạn T04, không cần lưu payload quá lớn để thử nghiệp vụ.

Ví dụ request/record, trong đó null là đầu vào cần thử sau khi bổ sung rule:

```json
{
  "supplier_name": "Nhà cung cấp mẫu A",
  "description": "Báo giá vật tư giả lập",
  "total_amount": "1000000",
  "currency": "VND",
  "expires_on": null
}
```

### QuotationValidation

#### Validation nền đã triển khai

POST /api/v1/quotations/{UUID}/validate không nhận body hoặc nhận JSON null. Body có dữ liệu, kể cả profile/reference_date/flags/approved/artifact do client khai, trả 400 INVALID_REQUEST trước mở transaction. Quyền read và validate được kiểm tra hiện tại trước đọc record; reader không có validate trả 403 kể cả ID không tồn tại. Operator có đủ hai quyền. Không có quyền duyệt code/deploy trong grants app này.

Service đọc record đã lưu qua transaction, rồi gọi [validate_quotation](../../backend/app/quotation_demo/business/quotation_validation.py), không sửa record hoặc lưu metadata retry/approval/test. Đây là phép tính đồng bộ chỉ đọc, không cần Idempotency-Key; gọi lại tính lại từ record/code đang chạy, không replay quyết định cũ. Lỗi quyền/storage và not-found giữ envelope/mã như các thao tác khác. Không có lịch sử validation bền vững hoặc trace nghiên cứu từ endpoint này.

App gốc sau kiểm tra input contract chưa có quy tắc nghiệp vụ, nên flags = [] và evaluated_rules = []. Đây là kết quả của **tập quy tắc rỗng được công bố**, không phải fallback khi validator lỗi, không chứng minh ngày hợp lệ hoặc báo giá đã được duyệt. validation_config_ref = quotation-baseline-v1 chỉ định danh hành vi nền, không phải digest của code. reference_date = null vì baseline không so sánh ngày; active_artifact = null vì chưa có launcher/gate cung cấp evidence tin cậy. Không tự lấy ngày máy, mốc fixture hoặc hash tên file để điền hai trường này.

Ví dụ response data nền:

```json
{
  "quotation_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "flags": [],
  "evaluated_rules": [],
  "validation_config_ref": "quotation-baseline-v1",
  "reference_date": null,
  "active_artifact": null
}
```

UI có nút Kiểm tra báo giá trong chi tiết; kết quả nền ghi Chưa áp dụng quy tắc nghiệp vụ, không hiển thị Đạt/Ngày hợp lệ/Đã duyệt. Kết quả phải thuộc đúng quotation_id đang chọn; đổi record, refresh, tạo mới, 401 hoặc đổi/ngắt phiên xóa kết quả tương ứng, response đến trễ bị bỏ qua.

#### Validation gắn artifact — thiết kế mục tiêu

Response mục tiêu giữ quotation_id, flags (mảng code/field/message), evaluated_rules, reference_date, validation_config_ref và active_artifact (id/digest). Chỉ launcher/control tin cậy mới cung cấp reference_date/config và artifact binding; phải hoàn thiện contract/runtime này trước đóng băng baseline nghiên cứu. Cờ expiration_review chỉ xuất hiện khi code artifact đang chạy có rule và đầu vào không đạt điều kiện ngày; không phải request field hoặc approval state. Không có cờ này không có nghĩa mọi validation khác đều đạt. Response không chứa boolean acceptance_passed khi ngưỡng nghiên cứu chưa được chọn.

Ví dụ riêng phần data sau khi artifact có rule được phê duyệt và kích hoạt; không phải output của backend hiện tại:

```json
{
  "quotation_id": "quotation-demo-01",
  "flags": [{"code": "expiration_review", "field": "expires_on", "message": "Cần xem xét ngày hết hạn"}],
  "evaluated_rules": ["expiration_review"],
  "reference_date": "2026-11-07",
  "validation_config_ref": "validation-demo-v1",
  "active_artifact": {"id": "artifact-demo-02", "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
}
```

## Resource của control

Registry identity/repository và snapshot đã nối HTTP/Workspace ngày 2026-11-11; migration 002/003 và service giữ nguyên. HTTP repository lấy scope từ principal hiện tại trong DB, không có Session endpoint hoặc API cấp quyền. Đã cấp principal/profile dev chỉ repository.read; môi trường Docker và cách dùng token ở [setup](../general/setup.md#2e-control-dev-trong-docker-khi-python-windows-bị-chặn). Các resource workflow/approval bên dưới vẫn là mục tiêu.

### HTTP snapshot đã triển khai

Control dùng Bearer riêng, không nhận token reader/operator của app báo giá. Mỗi thao tác lấy scope từ principal hiện tại qua RepositoryAccessService.describe_current, rồi service snapshot xác thực/kiểm repository.read lại trong transaction snapshot. Không có scope, root, path, role, profile hoặc digest do browser cấp. Các route không nhận query/body; UUID trên path chỉ là selector tài nguyên.

| Method/path | Thành công và data |
| --- | --- |
| GET /api/v1/repository | 200: tenant_id, repo_id, repository_identity, authority_epoch từ registry hiện tại |
| POST /api/v1/repository/snapshots | 201: snapshot_id, repository_identity, source_profile_digest, manifest_digest, files |
| GET /api/v1/repository/snapshots/{snapshot_id} | 200: metadata snapshot; files gồm file_id, path tương đối, digest, byte_size |
| GET /api/v1/repository/snapshots/{snapshot_id}/files/{file_id} | 200: snapshot_id, file_id, encoding = base64, content giữ đúng bytes đã lưu |

Response có data/meta v0.2 với identity_mode = fixture và request_id UUID do backend sinh; X-Request-ID khớp meta, Cache-Control: no-store và X-Content-Type-Options: nosniff. OpenAPI có schema response. CORS allowlist CORS_ORIGINS cho GET/POST và Authorization/Content-Type, expose X-Request-ID; không cookie credentials. Capture chưa idempotent: mất response hoặc hủy request không có nghĩa DB rollback; tạo lại có thể thêm snapshot cùng manifest, không tự retry.

Lỗi không echo input/exception/path/token: 400 INVALID_REQUEST cho body/query/UUID sai; 401 IDENTITY_REQUIRED kèm WWW-Authenticate; 403 ACCESS_DENIED trước đọc source khi thiếu quyền; 404 RESOURCE_UNAVAILABLE cho scope/ID/profile không khả dụng. 409 SOURCE_CHANGED khi source đổi giữa capture; 413 SOURCE_LIMIT_EXCEEDED hoặc PAYLOAD_TOO_LARGE. 503 gồm AUTHORITY_UNAVAILABLE, SOURCE_NOT_CONFIGURED, SOURCE_UNAVAILABLE, STORAGE_UNAVAILABLE hoặc INTEGRITY_UNVERIFIED; không trả bytes chưa xác minh. Lỗi lập trình trả 500 INTERNAL_ERROR, không giả thành snapshot rỗng. Body khai báo trên 64 KiB bị chặn trước route; bất kỳ body thực nào cũng bị từ chối vì thao tác này không có body.

Worker chỉ tải binding từ CONTROL_REPOSITORY_CONFIG và dùng DATABASE_URL/CONTROL_ARTIFACT_ROOT tường minh; không tự seed/sync quyền hoặc profile. CLI host ở [setup](../general/setup.md#2d-repository-snapshot-và-workspace). Chưa có list toàn repository, source write, Git revision, Agent, artifact/test/approval hoặc deployment.

### Contract snapshot nội bộ đã triển khai

RepositorySnapshotService nhận token/scope, capture tạo snapshot ID và file IDs UUID; get cần snapshot ID, read_file cần snapshot ID + file ID. read_bundle nội bộ cần snapshot ID, trả SnapshotBundle chứa snapshot, canonical profile bytes và toàn bộ CapturedSourceFile sau xác minh/commit cùng transaction. Mọi thao tác cần repository.read hiện tại và active profile digest trong DB khớp cấu hình backend; ID/digest không cấp quyền. Không nhận path/root/digest tùy ý từ người gọi. Các lỗi domain/adapter được ánh xạ ở mục HTTP snapshot phía trên; read_bundle và filesystem staging chưa có endpoint. Chi tiết path/limits, storage/transaction và trust boundary ở [snapshot architecture](architecture.md#snapshot-repository-đã-triển-khai) và [bundle/staging](architecture.md#bundle-snapshot-và-staging-đã-triển-khai).

SourceProfile canonical có kind = repository-source-profile/schema_version = 1, tenant_id/repo_id, repository_identity, paths sắp tăng dần và max_file_bytes/max_files/max_total_bytes. Manifest canonical có kind = repository-snapshot/schema_version = 1, tenant_id/repo_id, repository_identity, source_profile_digest và files sắp theo path; mỗi item gồm path/digest/byte_size. Dùng encoder cachesec-json-v1; raw source bytes giữ nguyên. Không đưa root tuyệt đối, token, clock hoặc snapshot/file IDs ngẫu nhiên vào content digest. Wrapper DB giữ snapshot/file ID, actor/authority epoch và thời điểm tạo. Đây chưa phải artifact manifest hoặc ChangeBinding, không có runtime/test/deploy evidence.

Get kiểm profile và manifest blob với metadata; read_file kiểm thêm hash/size payload của file. Snapshot được lưu vẫn giữ bytes cũ khi working tree sửa; không tự nhận diện source hiện tại còn khớp để cho phép patch. Chưa có latest pointer/list/pagination, capture idempotency, Git base revision hoặc HTTP routes.

| Resource | Trường chính dự kiến | Ràng buộc |
| --- | --- | --- |
| Session | principal_id, tenant_id, capability_refs, policy_ref, identity_mode = fixture | Chỉ backend xác định; capabilities phải còn hiệu lực ở mỗi thao tác |
| RepositorySnapshot | repo_id, snapshot_id, source_digest, file references, config_ref | Backend đọc nguồn được phép; snapshot của working tree phải có digest, không chỉ commit/branch label |
| ContextRequest | id, repo_id, snapshot_id, intent_ref, namespace_ref, query_fingerprint, cache_mode, embedding descriptor/vector khi cần, status, bound_run/turn refs | Gắn principal/scope/config/prompt và request; không tái dùng như quyền vô thời hạn |
| ContextBundle | context_id, payload, dependency manifest, payload_digest, namespace/config/embedding refs, thời gian và integrity/admission reference | Browser lưu candidate; backend xác minh toàn bộ trước dùng, mọi content GET kiểm tra quyền hiện tại |
| WorkflowRun | id, task_kind = inspect/change, context_request_id, source/config refs, status, phase, proposal references, context_resolution/lookup outcomes, usage/errors | Một tác vụ có thể có nhiều turn/lookup/model calls; không tính chúng như các workflow độc lập khi đánh giá |
| AgentTurn | id, run_id, prompt, context_request_id, expected_proposal_revision nếu đã có, status/result/error, attempt refs | Không đổi repo hoặc tự mở rộng scope của run; follow-up tạo revision mới qua executor khi cần |
| ProposalRevision | revision_id, proposal_id, revision, base_snapshot_id, source_digest, patch_digest, diff/source refs, artifact/test/binding refs khi sẵn sàng | Source/diff bất biến theo revision; artifact/evidence chưa có được ghi null, không giả Tested |
| TestRun | id, proposal/revision, artifact/fixture/suite/config refs, status, evidence_digest, results/timeout/error | Không nhận raw command; kết quả thuộc đúng artifact được thực thi |
| ChangeBinding | binding_id/digest; repo, proposal/revision, base/source/patch, artifact, test/evidence, fixture/suite/config và target refs | Server tạo từ records đáng tin cậy; approve/activate cần binding đầy đủ, không null |
| ReviewDecision | id, decision = approve/request_changes, actor, proposal/revision, binding ref nếu approve, acknowledged digest, reason, approval_id (null khi không approve) | Approve là hành động người có quyền; proposer và reviewer có thể cùng principal |
| Approval | id, decision_id, binding_id, effective_status = active/revoked/expired/superseded/unverifiable và policy reference | Bản ghi riêng của control; hiệu lực phải được kiểm tra hiện tại, không phải cache entry hoặc credential do client gửi |
| Deployment | id, binding_id, approval_id, target_id, expected_target_version, status, activated_artifact_digest, reason | Gate kiểm tra lại cùng bytes/digest khi kích hoạt; không rebuild hoặc suy từ branch name |
| TargetState | id, repo_id, version, active_artifact reference/digest và activation_status | Version từ control/launcher đáng tin cậy; cho phép client gửi expected_target_version, không tự ghi trạng thái target |
| Event | event_id/cursor, request/run/resource refs, actor, type, timestamp, outcome/reason, spans/usage khi có | Chỉ phát sinh cho hành động đã thực thi; code/log nội dung bị giới hạn theo quyền và retention |

ChangeBinding và digest phải ánh xạ tới dữ liệu backend thực, không được dựng bằng cách hash các metadata client tự khai. Thuật toán tạo binding, tính bất biến và kiểm tra nguyên tử tại activation thuộc T04. Hồ sơ DB/quan hệ và nơi giữ artifact bytes thuộc T03; các bảng ở đây là kiểu resource, không phải SQL schema.

### Request của context, run và turn

Ký hiệu dưới đây mô tả shape wire, không phải source TypeScript/Python đã được thêm. Dấu ? là trường có thể vắng mặt; Id/Revision/ConfigRef/JsonValue theo bảng kiểu chung, không thay bằng role/path tự khai.

```text
SourceRef = { kind: "snapshot" | "proposal_revision", id: Id }
ContextRequestCreate = {
  repo_id: Id, source_ref: SourceRef,
  purpose: "inspect" | "change", prompt: string,
  cache_mode: "local" | "none", config_ref: ConfigRef,
  run_id?: Id
}
LookupReport =
  { kind: "candidate", candidates: [{ entry_id: Id, context_bundle: ContextBundle }] }
  | { kind: "no_candidate" }
  | { kind: "client_storage_error", code: string }
  | { kind: "not_applicable" }
RunCreate = { context_request_id: Id, lookup_report: LookupReport }
AgentTurnCreate = {
  context_request_id: Id, lookup_report: LookupReport,
  expected_proposal_revision: Revision | null
}
StartTestRequest = { expected_revision: Revision, test_profile_ref: ConfigRef }
```

task_kind của run và prompt của turn lấy từ ContextRequest do server đã lưu, không nhận hai prompt/config mâu thuẫn nhau rồi dùng proof của prompt cũ cho prompt mới. Nếu ContextRequest phục vụ turn tiếp theo, run_id phải khớp run đích; SourceRef phải thuộc repo/run/scope hiện tại. purpose = change không tự cấp quyền ghi hoặc cho phép thay đổi ngoài nhiệm vụ đã đăng ký.

Khi submit đầu tiên thành công, ContextRequest gắn với run/turn đó; retry cùng operation/key dùng lại resource đã tạo, submit cho operation khác phải conflict và chuẩn bị request mới. cache_mode = none chỉ dùng report not_applicable; local dùng các nhánh còn lại, candidate list không rỗng và kích thước theo giới hạn T04. ContextBundle trong report luôn là input không tin cậy. Test profile tham chiếu suite/fixture/config đã đăng ký; không nhận arbitrary command hoặc kết quả test do client khai.

Ví dụ tạo request chuẩn bị context; đây không phải lời gọi được thực thi:

```json
{
  "repo_id": "repository-demo-01",
  "source_ref": {"kind": "snapshot", "id": "snapshot-demo-01"},
  "purpose": "change",
  "prompt": "Bổ sung quy tắc đánh dấu báo giá thiếu ngày hết hạn hợp lệ.",
  "cache_mode": "local",
  "config_ref": "workflow-demo-v1"
}
```

## Chuẩn bị context và chạy Agent

1. Host tạo ContextRequest bằng repo/source reference, prompt/purpose và ConfigRef đã đăng ký; backend kiểm tra identity/scope, xác định snapshot/namespace và chuẩn bị query/embedding khi cache local cần. Request có trạng thái preparing/ready/failed/expired; lỗi embedding được ghi là lỗi, không giả Miss.
2. Browser tìm candidate theo ContextRequest đã ready. cache_mode = none bỏ local lookup và embedding phục vụ lookup, vẫn giữ authorization và retrieval cần thiết; không ghi No Cache thành Miss.
3. Host tạo WorkflowRun/AgentTurn bằng context_request_id và lookup report. Report là candidate (entry references/payload), no_candidate, client_storage_error hoặc not_applicable; đây là thông tin client, chưa phải kết luận trusted Hit. Không để report thay namespace/principal/config của ContextRequest.
4. Backend kiểm tra ContextRequest còn khớp identity/repo/snapshot/config hiện tại, rồi verify candidate. Snapshot của request đã đổi thì trả stale/conflict để chuẩn bị lại; chỉ candidate cũ bị stale thì ghi Rejected và có thể authorized retrieval trên request snapshot còn hợp lệ. Hit chỉ sau verifier pass.
5. LLM chỉ nhận payload đúng binding/request đã xác minh; kiểm tra freshness và nguồn tại điểm dùng theo T04. Miss/Rejected có thể retrieval có quyền rồi generation/admission; authority hoặc integrity không xác minh được thì không dùng payload local. Cache/storage/embedding lỗi phải phân loại riêng; fallback chỉ theo policy đã chốt và quyền mới được xác minh, không tự chuyển mọi lỗi thành Miss.
6. Host chỉ được nhận ContextBundle để ghi local khi admission policy cho phép và quyền trên mọi dependency còn phù hợp. Ghi local thất bại được báo là cache write error; không đổi kết quả generation đã thành công thành một Hit. Retention/logout/account switch và offline policy còn chờ T04.

Browser query embedding và việc xác minh/mạng đều có chi phí, phải giữ request/run/lookup IDs và spans để đo end-to-end. Không cộng duration trùng nhau hoặc suy LLM calls saved từ Context Hit. Một lookup có thể reject candidate rồi hit candidate khác; terminal outcome và candidate outcomes được ghi riêng theo [cache flow](cache.md#lookup-verification-và-fallback-mục-tiêu).

```mermaid
sequenceDiagram
    participant H as Host IDE/web
    participant L as Local cache
    participant B as Trusted control
    participant A as Agent/model adapter
    H->>B: Chuẩn bị ContextRequest
    B-->>H: Snapshot/namespace/query được phép
    H->>L: Lookup candidate
    L-->>H: Candidate hoặc không có
    H->>B: Tạo run/turn với lookup report
    B->>B: Xác minh hoặc authorized retrieval
    B->>A: Context đã xác minh
    A-->>B: Answer/proposal hoặc lỗi thật
    B-->>H: Run state và resource references
```

## Danh mục thao tác HTTP dự kiến

Các path dưới đây nằm sau /api/v1 trên base URL tương ứng. Mọi ID phải được kiểm tra access; không chỉ kiểm tra lúc tạo resource. Danh sách/events dùng cursor giới hạn theo scope và sau khi lọc quyền; cursor không cấp quyền đọc. Giới hạn trang/payload và deadline phải có trong config được khóa ở T04, chưa tự ấn định số.

| Base | Method/path | Request | Response thành công |
| --- | --- | --- | --- |
| App | POST /quotations | QuotationCreate | 201 QuotationRecord |
| App | GET /quotations; GET /quotations/{id} | Cursor hoặc Id | 200 danh sách có next_cursor hoặc QuotationRecord |
| App | POST /quotations/{id}/validate | Nền: không body/JSON null; profile runtime tin cậy còn là thiết kế | 200 QuotationValidation; baseline có active_artifact/reference_date null |
| Control | GET /session | Không nhận role/tenant trong body | 200 Session |
| Control | GET /repositories/{id}/snapshot | Source reference được phép | 200 RepositorySnapshot |
| Control | GET /repositories/{id}/snapshots/{snapshot_id}/files/{file_id} | Opaque file reference do backend cấp | 200 nội dung/path tương đối/digest được phép; không nhận absolute path tùy ý |
| Control | POST /context-requests; GET /context-requests/{id} | Repo/source, prompt/purpose, cache_mode = local/none, ConfigRef; hoặc Id | 202 resource khi tạo, 200 status/result khi đọc |
| Control | POST /runs; GET /runs/{id} | RunCreate (task kind từ ContextRequest ready); hoặc Id | 202 WorkflowRun khi tạo, 200 khi đọc |
| Control | POST /runs/{id}/turns | AgentTurnCreate; prompt lấy từ ContextRequest ready | 202 AgentTurn; việc sinh proposal do backend/executor quản lý |
| Control | GET /runs/{id}/events; GET /runs/{id}/context | Cursor hoặc context reference thuộc run | 200 events hoặc ContextBundle đã được phép trả; không trả plaintext khi đã mất quyền |
| Control | GET /proposals/{id}; GET /proposals/{id}/diff | Revision reference cụ thể | 200 ProposalRevision hoặc diff cùng source/revision/digests |
| Control | POST /proposals/{id}/tests; GET /test-runs/{id} | StartTestRequest hoặc Id | 202 TestRun khi tạo, 200 evidence/outcome khi đọc |
| Control | POST /proposals/{id}/decisions | ApproveRequest hoặc RequestChangesRequest bên dưới | 201 ReviewDecision, approval reference chỉ khi được approve hợp lệ |
| Control | POST /deployments; GET /deployments/{id} | ActivationRequest hoặc Id | 202 Deployment khi đủ điều kiện nhận việc; 200 trạng thái/outcome khi đọc |
| Control | GET /deployment-targets/{id} | Target reference được phép | 200 TargetState, active artifact/version thực tế do control theo dõi |

Không có endpoint để client ghi Approved, test_passed hoặc deployed; không nhận shell command, OS path hay raw artifact bytes để chạy trực tiếp từ UI. Trường cấu hình do request tham chiếu phải nằm trong registry/scope được phép; không cho request thay policy của run đã khóa. CORS/methods/credential transport sẽ cấu hình khi triển khai, không giả định GET-only hiện tại đã hỗ trợ các route này.

### Request duyệt và kích hoạt

- ApproveRequest: decision = approve, expected_revision, binding_id và acknowledged_binding_digest. Binding phải đầy đủ test/artifact/evidence và khớp bản người dùng đang xem; sai revision/digest phải conflict, không tự lấy bản mới nhất rồi duyệt thay.
- RequestChangesRequest: decision = request_changes, expected_revision, acknowledged_patch_digest và reason. Cho phép yêu cầu sửa trước khi có test/artifact, nhưng vẫn phải có quyền Reviewer và đúng source/patch được xem; không phát hành approval hoặc cấp quyền deploy.
- ActivationRequest: binding_id, approval_id, target_id và expected_target_version. Backend kiểm tra quyền deploy riêng, approval còn hiệu lực, target và mọi binding/digest; yêu cầu được nhận việc không có nghĩa activation đã thành công. Worker kiểm tra lại tại điểm kích hoạt, ghi đúng activated_artifact_digest.

```text
ApproveRequest = {
  decision: "approve", expected_revision: Revision,
  binding_id: Id, acknowledged_binding_digest: Digest
}
RequestChangesRequest = {
  decision: "request_changes", expected_revision: Revision,
  acknowledged_patch_digest: Digest, reason: string
}
ActivationRequest = {
  binding_id: Id, approval_id: Id, target_id: Id,
  expected_target_version: string
}
```

Các trường actor/tenant/grants/timestamps và actual digest do backend đọc hoặc tính, không lấy client echo làm bằng chứng. Với self-approval, quyền Reviewer phải thực sự được backend cấp; việc cùng proposer không được tự cho qua hoặc tự chặn. Agent chỉ có tập capability đọc/đề xuất/test được ủy quyền, không thể gọi quyết định/activation thay người dùng có nhiều vai trò.

### Binding và deployment local v0.1 — đề xuất

Phần này chỉ cụ thể hóa [phương án gate local](authorization.md#phương-án-gate-local-v01-để-chốt), **thuộc thiết kế đã được người dùng chọn; chưa phải HTTP API/control schema đầy đủ đã triển khai**. Không đổi contract của endpoint báo giá đã chạy, không tự cấp grants mới. Kiểu Id/Digest chung v0.2 vẫn dùng cho phần mục tiêu khác; gói v0.1 đã được chọn; encoder bên dưới đã có implementation cho metadata bytes, không tự kiểm schema/provenance/binding đầy đủ.

[Encoder hiện có](../../backend/app/artifacts/metadata_encoding.py) nhận Python object đã được caller kiểm schema, không nhận JSON wire text và không phát hiện duplicate key đã bị decoder khác làm mất. Giới hạn encoding v1: metadata tối đa 64 KiB, nesting tối đa 32; ASCII string/keys, null/bool và integer 0..2^53−1 theo schema caller, không floats. Encoder giữ array order, không tự sort file/resource refs hoặc coi kind tùy ý là artifact hợp lệ. Root cần kind không rỗng và schema_version = 1; encoder-check vectors bên dưới khớp test. Chuẩn hóa/kiểm schema từng loại manifest, binding và trusted registry vẫn thuộc các use case tiếp theo.

#### Quy tắc bytes để tính digest

Đề xuất SHA-256 trên bytes source/blob nguyên trạng. Manifest/binding/evidence metadata dùng encoder profile cachesec-json-v1: JSON UTF-8 không BOM hoặc newline cuối, keys sắp thứ tự, không whitespace ngoài string; serializer tương đương Python json.dumps với sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False. Giới hạn schema này vào key ASCII cố định, UUID/digest/profile refs ASCII, chuỗi path allowlist không alias và integer không âm trong khoảng 0..2^53−1; cấm floats, duplicate key và giá trị không thuộc schema. Array file refs sắp theo path, resource refs theo ID khi là tập hợp; array có thứ tự nghiệp vụ như argv phải giữ thứ tự. Không chuẩn hóa hoặc băm lại source qua encoder JSON. Đây là **profile riêng có version**, không tuyên bố tương thích RFC 8785; cần golden byte/digest vectors trước triển khai. Các tùy chọn serializer được mô tả ở [Python json](https://docs.python.org/3.12/library/json.html).

Ví dụ công thức đặc tả, chưa phải digest thật:

```text
blob_digest     = SHA256(raw_bytes)
artifact_digest = SHA256(encode(manifest_without_its_own_digest))
binding_digest  = SHA256(encode(binding_without_its_own_digest))
```

Mỗi root có kind/schema_version để phân biệt namespace nội dung. Digest tự thân không chứng minh quyền hoặc nguồn tin cậy: chỉ server đọc blob/snapshot/evidence đã đăng ký mới tạo binding ready. Mọi hash tự khai từ client là giá trị để đối chiếu, không được dùng để đăng ký artifact/evidence được tin cậy. Bytes metadata có thể tái tạo từ object đã kiểm schema, không băm chuỗi JSON tùy cách format của browser.

Patch identity đề xuất dùng manifest kind = patch-manifest, schema_version = 1 và files sắp theo path; mỗi item có path, operation, base_blob_digest và candidate_blob_digest. Scope ban đầu chỉ cho modify file thường đã allowlist; thêm/xóa/rename phải có profile mới được review. patch_digest là hash bytes manifest này, không phải ảnh chụp UI hoặc diff đã prettify/chuẩn hóa newline. Unified diff hiển thị được control dựng từ đúng hai blob refs; trước approve phải bảo đảm diff đang xem và binding cùng base/candidate. ID/digest/timestamps của bản ghi wrapper không nằm trong canonical body tự tham chiếu; các resource refs cần thiết bên trong body vẫn được băm theo schema.

Vectors encoder dưới đây đã tính bằng Python cho tài liệu; không phải artifact/fixture digest hoặc bằng chứng nghiên cứu. Bytes ở cột đầu không có newline cuối; đảo thứ tự object keys phải cho cùng bytes/digest, đổi thứ tự array thì khác trừ khi schema quy định sort trước encode.

| Bytes encoder kiểm chứng | SHA-256 |
| --- | --- |
| `{"ids":[],"kind":"encoder-check","schema_version":1}` | `c4711975fa2e10dbb0f3f03789b6b9d292aa6441fef0c653c3af9e483dddede8` |
| `{"ids":["a","b"],"kind":"encoder-check","schema_version":1}` | `f7f26fcfb7e7e7ec36c7b2aee9c79f08b106ed9b7bd5100446312f87bbbf9d2a` |

#### Nội dung binding và request

Binding v0.1 đề xuất có kind/schema_version; tenant_id/repo_id; proposal_id/revision; base và candidate snapshot IDs/digests; patch blob digest; artifact ID/manifest digest; runtime image/platform, public config và launcher profile digests; test_run_id/evidence_digest; suite/harness/config/fixture refs và digests; target_id/target_policy_digest. Các dependency này không null khi binding ready; policy/authority refs của quyết định còn lưu ở approval/permit, không được cập nhật bytes binding cũ. Khi fixture/harness/config cần thiết chưa đăng ký thì ready không được tạo, không dùng nhãn demo thay digest thật.

Shape ApproveRequest và ActivationRequest ở trên giữ nguyên. Acknowledged digest phải bằng binding server đã hiển thị; các resource phải thuộc cùng scope và còn đúng proposal revision. Server không tự lấy revision mới nhất để sửa request cũ. expected_target_version là token opaque do GET target trả, kiểm dưới lock, không suy từ timestamp hoặc client counter. Mỗi lần target được đối soát ổn định sau operation có side effect phải có version mới kể cả quay về cùng artifact, để tránh ABA; binding và approval không được tự chuyển sang một target khác.

| Resource bổ sung trong đề xuất | Trường cần có và ngữ nghĩa |
| --- | --- |
| Approval effectiveness | approved_at/expires_at, revoked/superseded refs, policy/authority refs và reserved_deployment_id; GET tính hiệu lực hiện tại, không sửa decision lịch sử hoặc lặp lại chữ Approved như quyền còn hiệu lực |
| Deployment | status queued/preparing/dispatching/reconciling/succeeded/blocked/failed/unknown; phase, reason_code, binding/approval/target/expected version, attempt refs và observed target state |
| Dispatch permit nội bộ | deployment/attempt/target/fence, binding/artifact/config digests, authority epoch/policy và issued_at; chỉ control/launcher dùng, không trả như bearer credential hoặc nhận từ client |
| Target observation | launcher operation/container ref, image/mount/config/artifact refs, observed endpoint/health và observation ID/time; control xác minh, không lấy duy nhất self-report của app |

UNKNOWN là trạng thái nghiệp vụ khi không xác định side effect, không được map thành failed-no-effect hoặc rollback. GET deployment/target trả 200 với state đã biết và reason phù hợp; HTTP 200 không có nghĩa deployed. queued/preparing/dispatching chỉ thành succeeded khi có observation đúng artifact và commit target/event; timeout sau dispatch chuyển reconciling/unknown. Workflow đang deploying khi đó giữ waiting + phase reconciling_deployment; chỉ kết luận terminal sau đối soát hoặc ghi terminal unresolved theo protocol đã khóa, không báo code mới chưa chạy hay đã chạy khi thiếu bằng chứng.

| Lỗi bổ sung đề xuất | HTTP/outcome và phản ứng |
| --- | --- |
| APPROVAL_REQUIRED / APPROVAL_INEFFECTIVE / EVIDENCE_NOT_READY | 409 khi cùng scope nhưng chưa đủ điều kiện; thiếu capability vẫn 403, authority unavailable 503; không đưa vào queue để worker tự duyệt |
| TARGET_BUSY / TARGET_STATE_UNKNOWN / TARGET_VERSION_CONFLICT | 409, đọc status được phép; không đổi target hoặc key để vượt reservation |
| ARTIFACT_MISMATCH / CONFIG_MISMATCH / BINDING_MISMATCH | 409 trước side effect; nếu phát hiện sau dispatch thì resource unknown/failed theo observation, không tự gán chưa chạy |
| ACK_UNKNOWN / COMMIT_UNKNOWN | Resource reconciling/unknown khi đã có operation ID; nếu response nhận operation cũng mất thì client tra lại cùng Idempotency-Key. Không cấp key/approval mới để gọi lại mù |

Idempotency replay luôn kiểm current identity/scope, trả cùng deployment hiện tại, không phát permit mới hoặc làm approval hết hiệu lực sống lại. Key được giữ cùng retention metadata; key trùng nội dung khác conflict. Một approval có thể đang reserved/expired trong GET khi operation đã được cấp permit trước đó; trạng thái operation phải báo theo observation thật, không ghi ngược rằng activation lúc đó chưa được duyệt. Thời điểm kiểm quyền/expiry và ảnh hưởng revoke được định nghĩa tại R3 của authorization.

## Ma trận capability theo thao tác

Đây là yêu cầu quyền ở mức thao tác; **chưa phải mapping user/role/tenant hoặc chính sách grants mới đã được chốt**. T04 quyết định mapping, delegation và freshness. Quyền đọc app báo giá độc lập với quyền sửa code trong control.

App dùng adapter quyền theo contract identity/scope của chính entrypoint đó; không import code workflow/control/cache để chạy validation. Việc chia sẻ khai báo fixture/config không đồng nghĩa chia sẻ model nghiệp vụ hay bỏ kiểm tra quyền. Cách phân phối/bind identity giữa hai entrypoint cần đối chiếu tại T04, chưa chọn một gateway hoặc phương thức đăng nhập mới.

| Nhóm thao tác | Capability cần được cấp trên scope tương ứng | Agent được ủy quyền? |
| --- | --- | --- |
| Đọc/tạo/validate báo giá | quotation.read / quotation.create / quotation.validate | Không tự thêm vào tools của Agent sửa code |
| Đọc repo/snapshot/file/context | repository.read; mọi dependency phải được phép | Có, trong repo/path/task scope |
| Chuẩn bị context, tạo run/turn | repository.read + workflow.run; khi change cần proposal.create | Có, trong delegation đã được cấp |
| Đọc run/proposal/test/events | workflow.read, cùng quyền hiện tại với dữ liệu/source chứa trong response | Có, nếu nằm trong delegated scope; IDs không thay quyền |
| Đọc ContextRequest/ContextBundle/deployment status | workflow.read và repository.read cho context; deployment.read cho target status, luôn kiểm tra scope nội dung | Chỉ khi được ủy quyền đọc; không suy quyền activate từ việc xem status |
| Đề xuất bản sửa, chạy test | proposal.create + test.run trong đúng source/suite | Có, qua executor có scope; không nhận arbitrary commands |
| Duyệt/yêu cầu sửa | change.review trên repo/change hiện tại | Không; human decision, kể cả principal khởi tạo Agent cũng có Reviewer |
| Kích hoạt | deployment.activate trên target, kèm approval/binding hợp lệ | Không; control thực thi sau request có authority phù hợp |

Một operation cần nhiều capability phải đủ tất cả, không kiểm tra chỉ một nhãn role. Mọi GET/status/event/context cũng re-authorize nội dung; quyền hết hiệu lực không tiếp tục stream/poll plaintext theo session/quyền cũ. Chi tiết freshness và cách kết thúc phiên đọc dài thuộc T04; không tuyên bố thu hồi plaintext đã được đọc.

## Trạng thái và chuyển trạng thái

WorkflowRun dùng status = queued/running/waiting/completed/blocked/failed/timed_out/cancelled cùng phase bên dưới; backend là nguồn state. TestRun, AgentTurn và Deployment có status/outcome riêng, không đồng nhất một request HTTP lỗi với terminal outcome của cả workflow.

| Phase hiện tại | Sự kiện hợp lệ | Phase/status tiếp theo |
| --- | --- | --- |
| queued | ContextRequest/current scope hợp lệ | resolving_context / running |
| resolving_context | Verify/retrieval hợp lệ | generating / running |
| resolving_context hoặc generating | Authority unavailable, source conflict hoặc upstream lỗi chưa xử lý được | blocked/failed/timed_out theo reason; không tạo proposal giả |
| generating, task inspect | Answer hoàn tất | completed; không sinh test/approval/deploy events |
| generating, task change | ProposalRevision thật được tạo | awaiting_tests / waiting |
| awaiting_tests hoặc awaiting_revision | Nhận lệnh chạy test hoặc turn sửa đúng revision/scope | testing hoặc generating / running |
| awaiting_approval hoặc awaiting_deployment | Nhận turn yêu cầu sửa đúng revision/scope | generating / running; không dùng approval cũ cho bản sửa mới |
| testing | Test/build thành công theo suite bắt buộc, evidence đúng artifact | awaiting_approval / waiting; không tự approve |
| testing | Test fail/timeout/error | awaiting_revision / waiting với TestRun outcome thật; không coi là pass |
| awaiting_approval | Reviewer approve đúng binding | awaiting_deployment / waiting |
| awaiting_tests, awaiting_revision hoặc awaiting_approval | Reviewer request_changes đúng revision | awaiting_revision / waiting; không tạo approval, không yêu cầu có artifact/test chỉ để từ chối |
| awaiting_deployment | Nhận activation có đủ quyền/binding | deploying / running; worker còn phải kiểm tra lại |
| deploying | Xác nhận đúng artifact đã được kích hoạt | completed; lưu Deployment succeeded và digest thực tế |
| deploying | Activation bị block/lỗi, chứng minh chưa có side effect | blocked/failed/timed_out theo reason; không hiển thị code mới như đã chạy |
| deploying | ACK/side effect chưa rõ | waiting + reconciling_deployment theo đề xuất local v0.1; lưu Deployment reconciling/unknown, không giả outcome terminal |

Source/patch/artifact/evidence liên quan thay đổi tạo binding/revision thích hợp mới, không sửa bytes/evidence trong approval cũ. Các quyết định hoặc test từ revision cũ không chuyển state bản mới. Một run có nhiều turn vẫn là cùng task; retry/turn failures và thời gian sửa phải giữ trong báo cáo workflow, không biến thành các mẫu độc lập.

Turn hỏi hiểu code trong một run đang chờ chỉ đọc/generate answer, giữ phase và binding của proposal. Turn yêu cầu sửa phải mang expected revision; khi executor chấp nhận bản sửa mới thì chuyển về awaiting_tests, test/approval không còn khớp không được dùng cho bản mới. Lỗi của turn không tự biến proposal cũ thành revision đã test hoặc artifact mới đã triển khai. Run inspect đã completed muốn hỏi tiếp phải tạo run có liên kết; khi thuộc cùng lượt nghiên cứu, runner phải gom các request/run liên quan vào cùng manifest task, không tăng mẫu số bằng số lượt chat.

Yêu cầu deploy thiếu approval hoặc thao tác sai quyền/state bị từ chối và ghi attempt event, không bắt buộc làm run đang chờ trở thành terminal: người dùng có thể bổ sung bước hợp lệ rồi tiếp tục. Chỉ runner/control ghi terminal khi tác vụ thực sự hoàn tất, bị hủy hoặc hết budget. State terminal không được tiếp tục mutate bằng turn/test/approval mới; tạo run có liên kết nếu cần làm lại. Deadline, retry budget, cancellation và việc xử lý activation chưa rõ kết quả cần khóa ở T04; không tự hủy một activation đã chạy hoặc báo timeout là chưa có side effect.

## Idempotency, concurrency và lỗi

Các POST tạo quotation/context/run/turn/test/decision/deployment dùng Idempotency-Key theo thiết kế này. Backend gắn key với principal, operation, scope và request fingerprint. Cùng key/cùng payload trả tham chiếu operation đã tạo, không enqueue job hoặc tạo decision/activation mới chỉ vì HTTP retry; key trùng nhưng payload khác trả conflict. Kiểm tra authority hiện tại trước replay dữ liệu; key không trở thành capability. Response phải thể hiện trạng thái/effectiveness hiện tại của resource, không khôi phục Approved chỉ vì decision cũ từng approve; approval bị revoke/stale không được làm sống lại bằng replay. Retention và cách quản lý key sau restart thuộc T03–T04.

Idempotency ở HTTP không tự bảo đảm external model call hoặc worker side effect chạy exactly once khi process chết hay timeout chưa rõ kết quả. Job/worker phải ghi attempt IDs, trạng thái đã biết/unknown và bằng chứng side effect; recovery/retry phải reconcile theo T03–T04 trước khi gọi lại. Mọi provider retry đã thực hiện vẫn có usage/error/span riêng, không coi là request mới độc lập hoặc giấu chi phí. Không báo deployed/test pass khi chỉ biết job đã được nhận.

Các thao tác trên proposal và deployment target phải có expected revision/version; stale request trả conflict và tham chiếu dữ liệu mới chỉ khi caller có quyền đọc. Không tự chuyển approval của tab cũ sang artifact mới. Activation và kiểm tra binding phải gắn cùng artifact bất biến; transaction DB đơn thuần không chứng minh process đang chạy đúng bytes, chi tiết activation protocol thuộc T04.

| HTTP/outcome dự kiến | Code/ý nghĩa | Cách client xử lý |
| --- | --- | --- |
| 400 | INVALID_REQUEST: JSON/body/type/unknown field không đúng contract | Sửa input; sai expires_on dạng JsonValue vẫn là dữ liệu domain, không bị parse thành lỗi HTTP trước rule |
| 401 | IDENTITY_REQUIRED: không có ngữ cảnh identity hợp lệ | Thiết lập lại identity qua cơ chế fixture đã chốt, không tự chọn role |
| 403 hoặc 404 theo T04 | ACCESS_DENIED / RESOURCE_UNAVAILABLE | Không trả source hoặc tiết lộ existence ngoài policy; không thử lại bằng scope rộng hơn |
| 409 | STALE_SNAPSHOT, STALE_REVISION, BINDING_MISMATCH, INVALID_TRANSITION, IDEMPOTENCY_CONFLICT | Đọc lại resource được phép và yêu cầu mới khi cần; không tự approve/deploy bản khác |
| 409 | CONTEXT_REQUEST_EXPIRED, CONTEXT_REQUEST_MISMATCH, CONTEXT_REQUEST_ALREADY_BOUND | Chuẩn bị ContextRequest mới đúng prompt/source/run; không dùng proof cũ cho operation khác |
| 413 | PAYLOAD_TOO_LARGE theo giới hạn được chốt | Giảm request; không ghi payload bị từ chối vào logs |
| 502/503 | UPSTREAM_UNAVAILABLE, AUTHORITY_UNAVAILABLE hoặc storage/executor service lỗi | Báo lỗi thật; authority lỗi không dùng cached payload. Retry/fallback chỉ theo policy và giới hạn đã chốt |
| 504 hoặc resource timed_out | TIMEOUT của thao tác đồng bộ hoặc job | Đọc status theo resource/idempotency key trước retry, không tự suy side effect chưa xảy ra |
| 200 với cache decision | Candidate bị Rejected hoặc không có candidate nhưng authorized resolution hoàn tất | Xem decision/reason và nguồn fallback; không coi Rejected là HTTP lỗi hoặc tất cả lỗi là Miss |

POST nhận job trả 202 và resource reference; GET resource trả 200 ngay cả khi job status failed/timed_out, kèm error/outcome của job. HTTP 200 khi đọc trạng thái không có nghĩa test pass/deploy thành công. Không retry tự động decision/activation bằng key mới khi kết quả chưa rõ. Provider retry nếu có phải instrument từng call, không giấu token/lỗi.

Ví dụ lỗi, không có code/source bí mật trong details:

```json
{
  "error": {
    "code": "STALE_REVISION",
    "message": "Bản thay đổi đã có revision mới.",
    "details": {"expected_revision": 1}
  },
  "meta": {"contract_version": "v0.2", "request_id": "request-demo-03"}
}
```

## Điều kiện đối chiếu trước triển khai

| Mục cần kiểm tra trong T03–T04/T05 trở đi | Kỳ vọng contract |
| --- | --- |
| Ngày missing/null/raw và ngày trước/bằng/sau mốc | HTTP/storage không cài trước rule; artifact có rule mới trả đúng flags, profile/mốc có version |
| Client giả tenant/role/score/hash hoặc sửa payload local | Không cấp quyền/Hit từ metadata client; trusted verifier kiểm tra tất cả dependencies trước dùng |
| ID run/context/proposal/test/approval của scope khác | Không đọc hoặc mutate qua ID trực tiếp, status/event/context cũng kiểm tra quyền |
| Cùng request/key được gửi lại; key trùng payload khác | Một operation được nhận, conflict khi nội dung khác; replay không bypass quyền hiện tại; các worker/provider attempt thực tế vẫn được ghi và reconcile |
| Revision/artifact/source/evidence/target đổi sau review | Quyết định cũ không phê duyệt bản mới; activation kiểm tra đúng artifact bytes |
| Developer có/không có Reviewer; Agent do Reviewer khởi tạo | Chỉ human có Reviewer được duyệt tường minh; Agent không được ủy quyền review/deploy |
| Test/model/cache/verifier/activation lỗi hoặc timeout | Không giả pass/Hit/deployed; có linked error/outcome/usage coverage, kiểm tra side effects trước retry |

Đầu ra thiết kế T02 v0.2 có types, quyền, state transitions, retry/lỗi và bảng ca đối chiếu. Sau bước thiết kế, đã triển khai OpenAPI/Pydantic/SQL và kiểm thử bốn thao tác báo giá như phần đầu tài liệu; mapping/freshness/limits của app đã chốt riêng. Mapping/grants, integrity, storage và sandbox/activation/deadline/cancellation cho control/cache vẫn cần T03–T04, có thể yêu cầu version contract mới. Chưa có SDK, workflow endpoints hoặc fixture nghiên cứu; không chọn thay quyết định bảo mật/nghiệm thu còn mở.
