# Chạy môi trường phát triển

## Phạm vi hướng dẫn

### Mở toàn bộ stack local bằng một lệnh

Với máy dev đã cấu hình ở các mục bên dưới, mở Docker Desktop rồi chạy từ root repository:

```powershell
.\scripts\start-local.ps1 -Studio
```

Lệnh khởi động database, control API 8000, API báo giá baseline 8001, test worker và frontend 3000; `-Studio` mở thêm Prisma Studio 5555. Trình duyệt mở Workspace; Báo giá ở `http://127.0.0.1:3000/quotations`, Studio ở `http://127.0.0.1:5555`. Bỏ `-Studio` khi không cần xem database; thêm `-NoBrowser` để chỉ bật dịch vụ. Chạy lại dùng các tiến trình đang có, không tự dừng app khác chiếm cổng.

Có thể dùng lệnh npm quen thuộc, từ thư mục `frontend`: `npm run local` bật stack và mở Workspace; `npm run local -- -Studio` mở thêm Studio. Khi dịch vụ đã chạy, `npm run workspace` chỉ mở phiên/project, không bật lại stack.

Workspace tự kết nối bằng phiên local tối đa 8 giờ, không cần dán token. Launcher đọc credential dev hiện có trong `backend/.local/control-access.env` ở server, phát liên kết dùng một lần hết hạn sau 60 giây qua URL fragment; giao diện xóa fragment trước request, đổi sang cookie HttpOnly và tự mở source. Reload/quay lại Workspace dùng phiên còn hạn. Ngắt kết nối hủy phiên; hết hạn hoặc liên kết đã dùng thì chạy lại `npm run workspace`. Liên kết mở project là capability tạm, không chia sẻ; token dài hạn không đi vào URL/argv/browser. Node 24.21.0 là môi trường đã kiểm chứng cho helper phiên local.

Chỉ hỗ trợ origin `http://127.0.0.1:3000` cho phiên local, không dùng địa chỉ LAN/localhost/cổng khác hoặc expose frontend ra mạng. Server Next cần quyền đọc `.local` private hiện có; không mount thư mục này vào candidate/Agent. [Ranh giới phiên local](../system/authorization.md#phiên-workspace-local) sở hữu chi tiết kiểm quyền, CSRF và giới hạn. Kết nối Bearer thủ công vẫn nằm trong mục thu gọn cho adapter/test. Màn Báo giá giữ realm riêng, dùng token fixture reader/operator trong `backend/.env`; phiên Workspace không cấp quyền báo giá. Worker có credential riêng.

Các process mới chạy nền, log tại `backend/.local/launcher`; đóng terminal không dừng chúng. Các container giữ nguyên volume DB. Launcher cần private config T12, venv/dependencies và image đã đăng ký; không tự cài dependencies, tạo secret, migrate, cấp quyền hoặc rebuild runtime app. API báo giá dùng đúng image nền đã ghim, không mount source working tree/candidate; profile phải khớp control và launcher từ chối đổi image của app baseline đã tồn tại. Env riêng chỉ sao chép DSN và hai token báo giá, đổi host/port từ loopback sang service DB sau khi đối chiếu `infra/.env`; file gốc giữ nguyên. Đây là app baseline local, không kích hoạt bản sửa hoặc thay gate.

Frontend dùng production build hiện có, build lần đầu nếu chưa có `.next/BUILD_ID`. Khi sửa UI cần build/restart frontend theo mục 3; chạy launcher lại không tự thay tiến trình đang hoạt động. Worker lock xác định root đang được sử dụng, chưa phải health/heartbeat của worker. Các HTTP probe chỉ đọc cấu hình workflow/dữ liệu báo giá, không tạo record hoặc chạy thí nghiệm. Máy chưa provisioning cần thực hiện các mục setup, không dùng launcher như installer.

### Agent GPT-6.1 Sol

Từ `frontend`, chạy `npm run local` rồi mở Workspace. Agent nằm cạnh editor; mô phỏng nằm ở `/ui/workspace-preview`, không còn là lựa chọn trên màn chính. Launcher chuẩn bị `backend/.local/agent-config/openai.env` nếu chưa có, giữ nguyên file đã tồn tại. Đặt `OPENAI_API_KEY=...` trong file này, lưu rồi mở nút **ⓘ Thông tin Agent** ở góc khung chat, bấm **Tải lại cấu hình**. Không dán key vào chat hoặc đặt trong `NEXT_PUBLIC_*`. Key phải có quyền/hạn mức dùng model; trạng thái Đã cấu hình chỉ chứng minh có key, không chứng minh provider đã chấp nhận.

Override `infra/agent.compose.yaml` chỉ mount thư mục cấu hình key read-only vào control API và đặt `CONTROL_AGENT_CONFIG=/run/agent/openai.env`; không mount vào app báo giá/candidate/harness hoặc Next. Adapter đọc lại file mỗi lần kiểm cấu hình/gọi model, không cần restart khi thay key. Chạy control native có thể đặt `CONTROL_AGENT_CONFIG` tới đường dẫn private tuyệt đối. Model cố định `gpt-6.1-sol` theo lựa chọn người dùng, endpoint cố định OpenAI Responses; không tự fallback sang model khác. [OpenAI Docs](https://developers.openai.com/api/docs/models/gpt-6.1-sol) xác nhận model ID.

Hỏi về source hoặc yêu cầu đề xuất sửa → xem đề xuất → **Áp dụng bản sửa** → xem diff bên trái → **Chạy test**. Source gửi tới OpenAI là ba file trong profile được cấp quyền; không gửi token/API key/control config. Context hiện là source gốc đã mở, không bao gồm draft chưa lưu. Model không có tool thực thi; apply/test do người dùng khởi tạo qua các API có quyền hiện tại, không phải duyệt hoặc triển khai. Hội thoại/usage chỉ trong phiên; chưa cache hoặc trace nghiên cứu. Missing key/quota/refusal/incomplete/provider error không sinh câu trả lời giả. Request có giới hạn body/context/output, socket timeout 75 giây, không tự retry; hủy trang bỏ response nhưng không bảo đảm hủy request đã tới provider hoặc phí của nó.

Các lệnh dưới đây chạy frontend, control health/readiness, **HTTP snapshot/Workspace, bản sửa/test Docker T12 và API/UI báo giá thật**, cùng Prisma Studio. Agent assistance cần key theo mục trên; chưa Agent tự điều phối, Local Semantic Cache hoặc approval/deployment control. Bối cảnh nghiên cứu đã đổi sang AI-assisted software development ngày 2026-11-02; UI chatbot nội bộ vẫn được giữ. Xem [hiện trạng](project-status.md) và [lộ trình PoC](implementation-plan.md).

Chỉ xem UI mô phỏng cần frontend; không cần backend, Docker/database hoặc API key. Backend health có thể chạy độc lập database. Chỉ cần khởi động Docker khi muốn kiểm tra hạ tầng PostgreSQL/pgvector; hướng dẫn này không yêu cầu cài thêm dịch vụ/model SDK.

Yêu cầu theo thành phần: frontend cần Node.js 20.9+ (mốc kiểm chứng trước ghi nhận Node 24), backend cần Python 3.12+, database cần Docker Desktop với Linux Engine đang chạy. Frontend dùng npm; backend dùng venv/pip. Chạy các lệnh sau từ thư mục gốc, bằng PowerShell.

## 1. Database

```powershell
if (-not (Test-Path -LiteralPath infra/.env)) { Copy-Item infra/.env.example infra/.env }
# Sửa POSTGRES_PASSWORD trong infra/.env, không commit file này.
docker compose --env-file infra/.env -f infra/compose.yaml up -d
docker compose --env-file infra/.env -f infra/compose.yaml exec db psql -U cachesec -d cachesec -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Lệnh kiểm tra giả định tên user/database mặc định. Database chỉ mở cổng localhost. Volume giữ dữ liệu khi dừng container. init.sql chỉ chạy lúc tạo volume mới; không xóa volume để cập nhật cấu hình vì có thể mất dữ liệu.

### Xem database bằng Prisma Studio

Studio là công cụ dev trong npm workspace frontend, ghim Prisma CLI **7.10.1** bằng package-lock.json. Cần Node.js 20.19+/22.12+/24+ (đã kiểm chứng Node 24.21.0). Sau khi PostgreSQL chạy và QUOTATION_DATABASE_URL đã cấu hình theo mục 2a, chạy từ thư mục gốc:

```powershell
npm --prefix frontend ci
npm --prefix frontend run db:studio
```

Mở **http://localhost:5555** theo URL terminal hiển thị, hoặc [mở thẳng bảng báo giá](http://localhost:5555/#schema=quotation_demo&table=quotations). Studio không tự mở cửa sổ browser; Ctrl+C trong terminal dừng công cụ. Mặc định Studio chọn schema public có thể trống: đổi Schema sang quotation_demo rồi chọn quotations; creation_requests là metadata retry, schema_migrations là lịch sử migration. Studio đọc trực tiếp schema hiện tại, khởi động không tạo/seed/migrate bảng. [Hướng dẫn Prisma Studio](https://www.prisma.io/docs/cli/v7/studio).

[prisma.config.ts](../../frontend/prisma.config.ts) chỉ lấy QUOTATION_DATABASE_URL: biến môi trường của terminal nếu đã đặt, nếu không thì đọc từ backend/.env bằng đường dẫn tương đối theo file config. Không fallback sang DATABASE_URL control, không chép DSN sang frontend/.env hoặc đưa mật khẩu vào command line. File backend/.env được parse cục bộ, không export các token fixture sang môi trường Studio. Thiếu/sai URI thì fail với thông báo ngắn không chứa DSN. Cấu hình tắt Prisma checkpoint telemetry cho process Studio.

Studio chạy local bằng quyền database trong DSN, **không phải phiên reader/operator của API**. Sửa dữ liệu ở đây đi trực tiếp vào database, không qua quyền/idempotency của API; không dùng Studio làm tool của Agent hoặc cơ chế duyệt/deploy. Backend Python và SQL migration vẫn là nơi sở hữu nghiệp vụ/schema. Studio chỉ phục vụ phát triển, không đưa vào runtime hoặc expose ra mạng.

## 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m uvicorn app.control.control_api:app --reload --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/health. PostgreSQL readiness: http://127.0.0.1:8000/ready. OpenAPI UI: http://127.0.0.1:8000/docs.

Đặt DATABASE_URL trong backend/.env bằng PostgreSQL URI tương ứng user/password/port/database đã cấu hình ở infra/.env. Percent-encode ký tự đặc biệt trong user/password của URI; không đưa credentials vào source, URL trình duyệt hoặc log. DATABASE_URL để trống vẫn chạy backend/health được; /ready trả 503 với database = not_configured. Khi DB kết nối và truy vấn được, /ready trả 200; lỗi DB trả 503 với database = unavailable, không trả nội dung exception.

DATABASE_CONNECT_TIMEOUT_SECONDS mặc định 3 (tối thiểu 2), DATABASE_STATEMENT_TIMEOUT_MS mặc định 1000 (tối thiểu 1). Đây là timeout kết nối libpq và statement PostgreSQL, không phải deadline end-to-end cho mọi sự cố mạng; connect timeout áp dụng theo host trong URI. Adapter giữ các options khác của DSN, không tự retry transaction hoặc tạo bảng/extension. /ready chỉ kiểm tra kết nối PostgreSQL, chưa kiểm tra schema/model/quyền/workflow; không yêu cầu vector khi chưa có năng lực dùng nó. /health chỉ kiểm tra process. CORS local không thay thế phân quyền.

## 2a. Migration và storage báo giá

App dùng QUOTATION_DATABASE_URL trong backend/.env, không tự dùng DATABASE_URL của control. Local có thể cấu hình cùng URI PostgreSQL; schema quotation_demo và cấu hình vẫn thuộc app riêng. QUOTATION_DATABASE_CONNECT_TIMEOUT_SECONDS / QUOTATION_DATABASE_STATEMENT_TIMEOUT_MS có mặc định 3 / 1000, cùng ý nghĩa timeout của adapter ở trên. Chạy từ backend:

```powershell
.\.venv\Scripts\python.exe -m app.quotation_demo.migrate_quotations
```

DB mới trả status = ok, scope = quotation_demo và applied = [001_create_quotations.sql, 002_creation_requests.sql]; DB đã có 001 chỉ áp dụng 002. Chạy lại applied = [] và giữ dữ liệu. CLI chỉ báo ok sau commit. Lỗi cấu hình/kết nối/history trả exit code 1 và mã lỗi ngắn, không DSN/exception. Migration có transaction/advisory lock/checksum, không chạy tự động khi khởi động API, /health hoặc /ready. Schema, quy ước missing/null và phục hồi batch lỗi ở [kiến trúc dữ liệu](../system/architecture.md#lưu-trữ-báo-giá-đã-triển-khai).

Store nội bộ [PostgresQuotationRepository](../../backend/app/quotation_demo/database/postgres_quotation_repository.py) nhận connection do caller quản lý; HTTP đi qua QuotationService để kiểm quyền và commit trước response. Xuất [model](../../backend/app/quotation_demo/business/quotation_models.py) với exclude_unset=True để giữ thiếu expires_on khác null. Chưa có validation ngày hoặc cờ expiration_review, không ghi dữ liệu nghiên cứu/seed khi migrate.

## 2b. API báo giá độc lập

Trong backend/.env (được Git bỏ qua), cấu hình hai token **khác nhau** cho QUOTATION_FIXTURE_READER_TOKEN và QUOTATION_FIXTURE_OPERATOR_TOKEN. Không có giá trị mặc định; API từ chối khởi động khi thiếu/không hợp lệ. Sinh mỗi token bằng secrets.token_urlsafe(32), lưu trực tiếp vào file local hoặc secret manager của máy; không đưa token vào Git, URL, command argument hoặc log. Ví dụ sau chỉ bổ sung giá trị còn thiếu và không in secrets; chạy trong backend, sau khi có .env và QUOTATION_DATABASE_URL:

```powershell
@'
from pathlib import Path
from secrets import token_urlsafe
from dotenv import dotenv_values, set_key
path = Path('.env')
values = dotenv_values(path)
for name in ('QUOTATION_FIXTURE_READER_TOKEN', 'QUOTATION_FIXTURE_OPERATOR_TOKEN'):
    if not values.get(name):
        set_key(path, name, token_urlsafe(32))
'@ | .\.venv\Scripts\python.exe -

.\.venv\Scripts\python.exe -m uvicorn app.quotation_demo.quotation_api:create_app --factory --host 127.0.0.1 --port 8001
```

App dùng http://127.0.0.1:8001; /docs và /openapi.json mô tả API, chọn Authorize để dùng Bearer token local. Control vẫn ở cổng 8000 với app.control.control_api:app; app báo giá không yêu cầu chạy control. Dùng một worker cho registry fixture trong process. Đây là identity fixture local, chưa phải đăng nhập production; không công khai service này ra mạng.

Ba thao tác là POST /api/v1/quotations (operator), GET danh sách và GET /api/v1/quotations/{UUID} (reader/operator). POST cần Idempotency-Key 1–128 ký tự ASCII; retry cùng key/body trả cùng record, đổi body với key cũ trả 409. Cả replay cũng kiểm quyền hiện tại. Cap QUOTATION_MAX_BODY_BYTES mặc định 65536, QUOTATION_MAX_PAGE_SIZE mặc định 100; chỉ cho phép hạ các cap này. Danh sách mặc định 50 mục, hoặc cap thấp hơn; cursor UUID không phải thứ tự thời gian.

[Contract API](../system/api.md#http-báo-giá-đã-triển-khai) sở hữu schema/lỗi; [authorization](../system/authorization.md#quyền-api-báo-giá-đã-triển-khai) sở hữu quyền/freshness. Hai identity đọc cùng dataset app, chưa có phân vùng tenant hoặc quyền Reviewer/deploy. Giao diện /quotations đã nối API, không dán token vào frontend source hoặc cấu hình public. Migration không tự seed/reset; metadata retry giữ nguyên, chưa có TTL/GC tự động.

Frontend mặc định gọi http://127.0.0.1:8001. Nếu đổi địa chỉ, đặt NEXT_PUBLIC_QUOTATION_API_URL trong frontend/.env.local theo frontend/.env.example rồi khởi động lại dev server hoặc build lại production; biến này chỉ chứa địa chỉ public, không chứa token. QUOTATION_CORS_ORIGINS trong backend/.env là JSON array origin frontend được phép, mặc định http://127.0.0.1:3000 và http://localhost:3000; đổi cổng frontend cần cập nhật origin và restart API. Chỉ GET/POST và các header cần thiết được cho phép, không cookie credentials. CORS không cấp quyền; request vẫn phải có Bearer hợp lệ.

Mở http://127.0.0.1:3000/quotations (hoặc Báo giá trong sidebar/toolbar Workspace), nhập giá trị token local vào ô password rồi Kết nối. Reader xem danh sách/chi tiết; operator tạo và dùng nút Kiểm tra báo giá trong chi tiết. Kết quả nền ghi Chưa áp dụng quy tắc nghiệp vụ, không xác nhận ngày hợp lệ hoặc approval; không có chọn role hoặc token tự động. Token chỉ ở bộ nhớ trang; reload/rời trang cần nhập lại, dữ liệu báo giá đã commit vẫn ở PostgreSQL. Với lỗi chưa rõ kết quả sau khi gửi, dùng Thử lại lần gửi để giữ nguyên body/key; rời trang/reload sẽ mất key đang chờ nên phải xem lại dữ liệu trước tạo lại. Đây là dữ liệu giả lập, chưa có rule kiểm tra ngày hoặc approval báo giá.

## 2c. Migration và blob storage control

Control dùng DATABASE_URL hiện có, không fallback QUOTATION_DATABASE_URL. Từ backend chạy:

```powershell
.\.venv\Scripts\python.exe -m app.control.migrate_control
```

Migration 001_artifact_blobs.sql tạo control.schema_migrations và control.artifact_blobs; CLI trả scope = control, applied có tên migration mới hoặc [] khi replay. History/lock riêng với báo giá, giữ nguyên SQL/checksum 001/002 quotation_demo. CLI chỉ báo ok sau commit, lỗi trả mã ngắn/exit 1 không DSN; không tự chạy khi mở API. Đã áp dụng DB local và đối chiếu app/retry counts/history giữ nguyên, index blob 0 row; không seed dữ liệu nghiên cứu.

Storage nội bộ lắp ghép qua app.control.control_storage.create_artifact_blob_storage. Cần DATABASE_URL và **CONTROL_ARTIFACT_ROOT là path tuyệt đối tường minh** trong backend/.env; ví dụ vị trí backend/.local/control-store sau khi người quản trị xác định ACL và bảo đảm ngoài path Agent được sửa. Kho bị Git bỏ qua, chỉ tạo thư mục khi publish; không fallback cwd/home hoặc đọc token từ config client. CONTROL_ARTIFACT_MAX_BLOB_BYTES mặc định/cap 1.048.576 byte, chỉ được hạ, không tự áp cap này vào cache. Không cần root để chạy migration/health/readiness; /ready vẫn chỉ kiểm PostgreSQL.

Migration 002_control_authority.sql thêm repositories/scope_authorities/principals/principal_grants; chạy cùng CLI control ở trên. Không seed repo/principal/token/grant hoặc tự áp migration khi mở API. Registry Python ở app.identity cung cấp RepositoryAccessService và PostgresControlAuthorityTransactions; thành phần tin cậy quản trị qua PostgresAuthorityAdministration trong database.connection(), giữ transaction đến commit. Cấu hình cần UUID tenant/repo/principal, repository identity, token digest/version, capability tường minh và expected_epoch. Đã có CLI cấp read-only và HTTP repository như mục 2d; không có startup sync hoặc admin HTTP; không tái sử dụng reader/operator token làm cấu hình control. [Quyền và giới hạn](../system/authorization.md#registry-control-nội-bộ-đã-triển-khai) sở hữu contract này.

Migration 003_repository_snapshots.sql thêm active profile/snapshot/file refs và FK digest/size, chạy cùng CLI. Đã áp dụng/replay local; app/registry/blob và checksum migration cũ giữ nguyên, không seed profile hoặc capture source thật. Factory app.control.control_snapshots.create_repository_snapshot_service nhận Settings và tuple RepositorySourceBinding do backend tin cậy cấu hình. Mỗi binding cần SourceProfile (scope/registry identity/exact paths/caps) và root tuyệt đối; không mặc định đọc repo, không nhận path từ browser hoặc fallback home/cwd. Profile dev ba file đã review/đăng ký và nối HTTP; mở rộng root/path vẫn cần review riêng.

Sau đăng ký repository/principal, backend tin cậy gọi PostgresSourceProfileAdministration(connection).set_profile(profile, expected_epoch=...) trong transaction để kích hoạt digest profile/tăng epoch. Factory không tự làm bước này. Capture/get/read_file yêu cầu repository.read và digest profile hiện tại trong DB khớp worker; cấu hình cũ bị block, không tự cập nhật policy. Profile root không chứa trong manifest; factory chặn profile đọc kho blob. [Snapshot architecture](../system/architecture.md#snapshot-repository-đã-triển-khai) ghi path policy/caps, giới hạn hai lượt đọc và các nội dung chưa có.

Chưa có API/UI upload/read blob hoặc artifact-ready. Snapshot files đã tạo quan hệ scoped cho đúng source bytes nhưng raw hash/index row vẫn không cấp quyền hoặc xác nhận bytes là test/artifact hợp lệ. Dev DSN owner/superuser vẫn có thể truy cập bảng; runtime roles/host ACL/sandbox cần được provisioning trước chạy code không tin cậy. Cơ chế publish/commit/orphan và giới hạn power-loss/host race ở [kiến trúc storage](../system/architecture.md#nền-blob-control-đã-triển-khai).

Kiểm tra `.\.venv\Scripts\python.exe -m pytest tests/artifacts tests/identity tests/repositories tests/control -q --tb=short` và đặt CACHESEC_TEST_DATABASE_URL nếu muốn phần DB thật. DB test dùng prefix cachesec_test_control_<UUID>, báo giá vẫn cachesec_test_quotations_<UUID>; helper chỉ dọn DB nó tạo thành công, không reset DB từ URL. Filesystem tests dùng thư mục tạm; sandbox Windows có thể từ chối thư mục private của pytest, cần lượt ngoài sandbox để kiểm chứng. Test directory alias tạo junction thật trên Windows bằng PowerShell (symlink trên hệ khác) chỉ trong thư mục test. Không sửa ACL máy hoặc coi lượt lỗi quyền/skip là đã pass. Không có GC/reset tự động cho kho app.

## 2d. Repository snapshot và Workspace

Sau migration control 001–003, chuẩn bị binding JSON trên host tin cậy. [quotation-source.example.json](../../backend/config/quotation-source.example.json) đề xuất ba file business của app báo giá để đọc: models, service và validation. Profile không phát hiện secrets trong nội dung và chưa đủ dependency/runtime/test để tạo artifact. Không mở toàn backend hoặc cấp quyền sửa. UUID trong ví dụ chỉ minh họa, không phải registry đã cấp quyền.

Từ backend, sao chép ví dụ vào backend/.local/repository.json được Git bỏ qua; đặt root tuyệt đối của checkout và UUID scope riêng. Review danh sách file trước áp dụng. Cấu hình DATABASE_URL và CONTROL_ARTIFACT_ROOT như mục 2c; thêm CONTROL_REPOSITORY_CONFIG là đường dẫn tuyệt đối đến JSON. Không đưa token hoặc quyền vào JSON này.

```powershell
New-Item -ItemType Directory -Path .local -Force | Out-Null
Copy-Item config/quotation-source.example.json .local/repository.json
# Sửa root/UUIDs trong file local; kiểm tra không đọc source hoặc đổi DB.
.\.venv\Scripts\python.exe -m app.control.configure_repository --config "$((Get-Location).Path)/.local/repository.json"
# Chỉ áp dụng sau review: thay UUID principal dưới đây bằng UUID riêng.
.\.venv\Scripts\python.exe -m app.control.configure_repository --config "$((Get-Location).Path)/.local/repository.json" --apply --principal-id 33333333-3333-4333-8333-333333333333 --credential-version 1 --expected-epoch 0
```

CLI hỏi token qua getpass, không echo/in token hoặc nhận token trong argv; dùng secret ngẫu nhiên độc lập với app báo giá, giữ bằng công cụ lưu secret local. Cấp duy nhất repository.read. expected_epoch = 0 chỉ cho repo mới; repo đã có cần epoch hiện tại, CLI không tự ghi đè cấu hình cũ. Command **thay tập grants của principal được chỉ định thành read-only**, nên dùng principal riêng; không bảo toàn các grants khác của Reviewer. Đăng ký repo/principal/profile cùng transaction, lỗi rollback; rotation phải tăng credential version. Không có admin HTTP hoặc tự sync khi API startup. Không dùng token ví dụ/test làm token dev.

Khởi động lại control bằng app.control.control_api:app tại loopback 8000. Frontend mặc định dùng http://127.0.0.1:8000; đổi địa chỉ qua NEXT_PUBLIC_CONTROL_API_URL rồi restart/build, chỉ đặt URL public, không token. Origin frontend phải thuộc CORS_ORIGINS. `/ready` vẫn chỉ probe PostgreSQL, không xác nhận profile/grants/snapshot sẵn sàng.

Trong `/workspace`, phiên local theo đầu trang tự mở source; adapter Bearer thủ công nằm trong mục thu gọn khi cần. Backend chụp snapshot và đọc sẵn file validation nếu thuộc profile; source khác chọn từ Explorer. Có thể mở snapshot cũ bằng ID; ID không cấp quyền. Bearer thủ công chỉ giữ bộ nhớ component; phiên local dùng cookie riêng. Snapshot lưu bytes bất biến, source hiện tại có thể đã đổi; binary/không phải UTF-8 không bị giả thành code. Profile không cấu hình T12 vẫn chỉ đọc; sửa/test tại mục 2f, Agent assistance cần key riêng; gate chưa có.

Kiểm tra HTTP: pytest tests/control/test_repository_http.py tests/control/test_repository_configuration.py với CACHESEC_TEST_DATABASE_URL; fixture tạo/dọn DB ngẫu nhiên. Browser opt-in dùng tests/control/repository_browser_server.py và `node scripts/browser-smoke.mjs --repository-only`: server cần DSN test, CACHESEC_BROWSER_CONTROL_TOKEN bắt đầu bằng test-only-, frontend production loopback 3100 và API test cổng 8000 còn trống. Cùng token test phải được cấp cho process Node; script không in token. Server tạo/dọn DB riêng và source copy tạm, origin 3100; dừng server sau test. Fault injection response trễ/403 chỉ kiểm trạng thái UI; test HTTP/DB kiểm revoke thật. Không seed DB ứng dụng bằng harness này.

## 2e. Control dev trong Docker khi Python Windows bị chặn

Người dùng đã xác nhận dùng Docker local cho API control dev, giữ chính sách Windows và dùng lại PostgreSQL hiện có. Đây là phương án dev hiện hành; cấu hình native ở mục 2d vẫn dành cho máy có runtime Python hoạt động.

Môi trường dev ngày 2026-11-11 đã cấu hình API control tại http://127.0.0.1:8000 và Workspace tại http://127.0.0.1:3000/workspace. Python native vẫn bị App Control chặn libcrypto đi kèm psycopg; event 3077 ghi policy VerifiedAndReputableDesktop, năm DLL/PYD khớp hash RECORD của package. Đây là blocker Windows, không phải lỗi migration/DSN; không tắt chính sách hoặc thay DLL để né chặn. Cách đối chiếu event theo [Microsoft](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/appcontrol-debugging-and-troubleshooting); Docker dev là môi trường chạy riêng, chưa phải native Windows đã được sửa.

[control.compose.yaml](../../infra/control.compose.yaml) tách project control khỏi project DB, dùng network cachesec_default và database container cachesec-db-1 hiện có. Không đổi volume, port hoặc secrets của PostgreSQL. Image build từ [Dockerfile.control](../../backend/Dockerfile.control), ghim Python base digest và dùng requirements-dev.lock.txt đã có; cài dependencies trước copy app. [.dockerignore](../../backend/.dockerignore) loại .env, venv, .local, test và các secret paths đã liệt kê. Đây là image dev, có tooling theo dev lock; không công bố là image production tối giản.

Control chạy UID/GID 10001, root filesystem read-only, drop ALL capabilities, no-new-privileges, tmpfs riêng; chỉ publish loopback 8000. Chỉ ba file business được mount read-only vào /source theo profile; không mount cả checkout, thư mục home hoặc Docker socket. Runtime vẫn là control tin cậy, dùng bridge network hiện có và DSN dev owner; **chưa có chặn egress, runtime DB role isolation hoặc sandbox cho code do Agent sửa**. Các cờ container không chứng minh safety property/gate.

Cấu hình đã chuẩn bị tại backend/.local, bị Git bỏ qua; ACL thư mục chỉ tài khoản hiện tại và SYSTEM. repository.json là binding host; repository.docker.json giữ cùng scope/identity/paths/caps nhưng root = /source. Root không thuộc profile digest, nên hai binding có cùng profile digest; tính đúng của root mapping vẫn do host tin cậy chịu trách nhiệm. control-runtime.env chỉ chứa DATABASE_URL trỏ container DB, CORS_ORIGINS và hai đường dẫn control; API đọc qua mount riêng, không mount backend/.env đầy đủ. control-access.env chứa duy nhất CONTROL_REPOSITORY_READ_TOKEN cho người dùng, không mount vào API hoặc đưa vào image/frontend bundle. control-access.json giữ principal/scope/version/epoch, không chứa token.

Đã đăng ký một principal mới chỉ có repository.read và active profile ba file, không có Reviewer/deploy. Khi nhập Workspace, mở control-access.env bằng editor local và sao chép giá trị token, không bao gồm dấu nháy của dotenv. Không in token bằng lệnh terminal hoặc đưa vào NEXT_PUBLIC_*. Kho bytes ở .local/control-store. Những file private này thuộc môi trường máy hiện tại; clone mới phải chuẩn bị cấu hình và áp CLI ở mục 2d, không tự phát sinh grant khi worker khởi động. Nếu cần áp CLI bằng Docker, dùng compose run tương tác với --entrypoint python rồi app.control.configure_repository, --config /run/control/repository.json và expected_epoch hiện tại; không truyền token trong argv.

Từ thư mục gốc, sau khi PostgreSQL hiện có đã chạy:

```powershell
$env:CACHESEC_ROOT=(Get-Location).Path
docker compose -f infra/control.compose.yaml config --quiet
docker compose -f infra/control.compose.yaml build control
docker compose -f infra/control.compose.yaml up -d control
# Dừng riêng API, giữ DB và kho bytes:
docker compose -f infra/control.compose.yaml stop control
```

Nếu port 8000 đang có API khác, kiểm tra và dừng đúng process sở hữu trước; không để hai control worker cấu hình khác nhau tranh port. Compose không tự provision quyền hoặc chạy migration; `/health` chỉ liveness, `/ready` chỉ PostgreSQL. Khởi động lại container không cấp lại quyền bị revoke. Cách publish loopback theo [Docker](https://docs.docker.com/engine/network/port-publishing/).

Đã kiểm chứng bytes/hash/size ba file HTTP khớp host, no-store/CORS/401; revoke đúng principal mới làm describe/get/file trả 403 không data rồi restore bằng epoch CAS trả 200. App/retry checksums và migration histories giữ nguyên. Browser dev smoke khác harness test tạm ở mục 2d: `$env:APP_URL='http://127.0.0.1:3000'` rồi `node scripts/browser-smoke.mjs --repository-dev` từ frontend; lệnh đọc riêng control-access.env, tạo một snapshot thật trong DB dev, không sửa source/quyền. Nó kiểm đúng ba file và ba bố cục 390/820/1440. Không dùng kết quả này làm fixture, acceptance hoặc run nghiên cứu.

## 2f. Bản sửa và test Docker T12

Mốc local đã provisioning: migration 004, profile image/inventory cố định và principal dev có đúng `repository.read`, `proposal.create`, `test.run`. Profile nguồn ba file giữ nguyên; chưa reviewer/deploy. Không chạy lại CLI read-only cho cùng principal vì nó thay tập grants. Cách tạo profile/đăng ký ở [workflow T12](../system/change-workflow.md); API startup không thực hiện các thao tác này.

Từ root, dùng thêm override khi `CONTROL_TEST_PROFILE_CONFIG` đã cấu hình:

```powershell
$env:CACHESEC_ROOT = (Get-Location).Path
docker compose -f infra/control.compose.yaml -f infra/test-workflow.compose.yaml up -d --build --wait control
$env:PYTHONPATH = "$env:CACHESEC_ROOT/backend"
.\backend\.venv\Scripts\python.exe -m app.testing.test_worker backend/.local/test-worker.json
```

Worker chạy foreground trong terminal riêng, giữ file lock; không chạy thêm worker cùng root. Python host không import psycopg/OpenSSL, không cần tắt App Control. Cấu hình private `test-worker.json` gồm `api_url` loopback, UUID `worker_id`, `credential_file` và `workspace_root` tuyệt đối. Credential file chỉ chứa secret worker; secret tương ứng nằm ở `CONTROL_TEST_WORKER_TOKEN` trong runtime env control. Không dùng token human cho worker, không đưa secret vào argv, browser hoặc image. `.local` cần ACL private như môi trường dev đã kiểm tra.

Chạy `npm run workspace` từ frontend → **sửa mã → Ctrl+S → Chạy test**. Snapshot/file mở sẵn; chỉ sửa bản riêng. Chạy test tự lưu nội dung chưa lưu trước khi tạo job; có thể test source nền chưa đổi. Proposal ID nằm trong Chi tiết để mở lại bản đã lưu sau reconnect/reload; bản nháp chưa lưu không tự khôi phục. Phiên local theo hướng dẫn đầu trang, bản sửa/evidence lưu backend. Khi bước tạo job lỗi, bản đã lưu vẫn hiện và có thể thử lại; kết quả cũ ghi Bản cũ khi revision tăng. Đây là technical smoke, chưa nghiên cứu hoặc triển khai.

Trong frontend: `$env:APP_URL='http://127.0.0.1:3000'; node scripts/browser-smoke.mjs --code-changes` chạy browser dev thật, tạo snapshot/proposal/job kỹ thuật. Worker và Docker phải đang chạy. Không xóa staging/test credential tự động; private root giữ lại để đối soát, chưa có GC.

## 3. Frontend (terminal khác)

```powershell
cd frontend
npm ci
npm run dev
```

Workspace thật ở http://127.0.0.1:3000/workspace. Bản mô phỏng tham chiếu nằm ở http://127.0.0.1:3000/ui/workspace-preview, mở từ UI templates. Trang mẫu có diff/code, chat phản hồi mẫu và hộp thoại test/approval; không đọc repository hoặc gọi model, không chạy test nghiệp vụ/gate. Vai trò và kết quả ở đây chỉ là fixture UI, nút Triển khai luôn khóa; reload reset mẫu. Không dùng trang này để thao tác source thật.

Kiểm tra riêng Workspace khi đã chạy server: từ `frontend`, chạy `$env:APP_URL='http://127.0.0.1:3000'; npm run test:browser -- --developer-only`. Script dùng Edge/Chrome, kiểm tra code và các hộp thoại/nhật ký ở bốn kích thước cùng tương tác demo, focus modal và bố cục hai vùng. Bỏ `--developer-only` để kiểm tra cả các trang cũ.

Mở http://127.0.0.1:3000 để dùng Chat, `/metrics` để xem Số liệu hoặc `/documents` để chọn/thả và phân loại tài liệu. Sidebar theo thứ tự Workspace → Báo giá → Thiết lập → Chat → Số liệu → Tài liệu. Trang `/setup` có [chín nhóm thông số thí nghiệm](../frontend/design.md#thiết-lập-thí-nghiệm); Lưu thiết lập tạo snapshot trong phiên, chưa chạy hoặc áp dụng vào Chat. Điều hướng giữ bản đã lưu, tải lại sẽ mất. Sau khi lưu có thể Xuất cấu hình JSON; thay đổi form cần lưu lại trước khi xuất. JSON/CSV ở Export Results chỉ chọn định dạng dự kiến, nút xuất kết quả đo chưa hoạt động vì chưa có run. Các alias embedding và manifest tài liệu đều là nháp; RBAC/ABAC, fine-tuning/FL và logging chưa có thực thi backend. `/chat`, `/settings` và `/experiments` chuyển về Chat; `/ui` giữ thư viện component cho phát triển, không nằm trong điều hướng chính. Chưa gọi AI/upload backend; không cần API key. Xem [tổ chức frontend](../frontend/design.md#tổ-chức-code).

Thử luồng: Chat → gửi câu hỏi hoặc tạo chat mới → sang Tài liệu → chọn danh mục rồi chọn/thả tệp → đổi phân loại từng tệp → tìm/lọc danh sách → quay lại Chat. Hội thoại, bản nháp và tệp giữ qua điều hướng trong phiên, mất khi tải lại. Tệp luôn ghi Chờ tải lên: chưa gửi server, chưa parse/embed hoặc được chatbot đọc. Nhãn Mô phỏng đã được bỏ khỏi giao diện; giới hạn thực tế vẫn thể hiện qua phản hồi mẫu, trạng thái tệp và thông số chưa đo/chưa xác minh.

Trong sidebar, bấm **Chat** hoặc mũi tên cạnh đó để mở/thu gọn lịch sử và nút **Chat mới** ngay bên dưới. Mỗi lần mở hiện 5 hội thoại mới tạo nhất; **Hiển thị thêm** mở tiếp từng nhóm 5 khi còn lịch sử. Chọn hội thoại giữ bản nháp và chế độ, kể cả khi đang ở Tài liệu.

Trong Chat, nhấn icon bánh răng nhỏ **Cài đặt chat** ở góc phải thanh trên cùng để chọn Không cache, Cache hoặc Cả hai. Mở phiên hoặc tải lại mặc định Cả hai. Chế độ Cả hai có hai vùng hội thoại không viền và một ô nhập gửi cùng prompt sang cả hai; đổi chế độ giữ lịch sử từng nhánh và bản nháp. Khi đang chờ, nút đổi chế độ và Chat mới tạm khóa. Cả hai nhánh vẫn trả lời mẫu, nhánh Cache chưa thực hiện lưu/tìm/reuse cache hoặc tạo số đo. Reload mất chế độ và lịch sử trong phiên.

Trang **Số liệu** có ba tab **Chung / Không cache / Cache**, chỉ giữ bộ lọc hội thoại, tổng hợp mọi lượt gửi trong hội thoại đã chọn. Chung có các biểu đồ tổng quan và bảng đối chiếu bên dưới: Không cache bên trái, tiêu chí ở giữa, Cache bên phải; giá trị tốt hơn được in đậm/tô màu khi có phép đo tương đương; hai tab riêng chỉ có biểu đồ, chất lượng/quyền và các lượt chạy nhánh tương ứng. Biểu đồ đường ở Chung dùng số truy vấn làm trục ngang, chọn Độ trễ/lượt gọi/token và kéo thanh Truy vấn để xem hai nhánh từng lượt. Không có số đo thì không vẽ đường độ trễ; nhánh không chạy tạo khoảng trống. Dùng phím trái/phải hoặc Home/End để chuyển tab. Bấm câu hỏi trong bảng để mở năm thông số; bảng phân trang 8 lượt. Usage demo bằng 0 ở nhánh đã chạy, chưa có lượt là dấu gạch; thời gian, hit rate, chất lượng và quyền chưa có phép đo/nhãn. Ở nguồn phiên Chat, dữ liệu cập nhật phản hồi đang chờ và mất khi reload; nguồn mặc định vẫn là fixture UI như mô tả bên dưới, chưa phải benchmark.

Mở Số liệu mặc định xem 24 truy vấn giả trong hai hội thoại, đủ thẻ chỉ số, đường biểu diễn, vòng cache, bảng so sánh và chi tiết. Đã bỏ công tắc Xem dữ liệu mẫu và dòng mô tả nguồn trên toolbar. Khi phát triển/kiểm thử, dùng `/metrics?source=session` để xem nguồn phiên Chat theo quy tắc trên; đổi query bằng điều hướng client giữ phiên, reload vẫn xóa Chat. Đổi nguồn reset bộ lọc/tab/biểu đồ/bảng. Fixture chỉ phục vụ xem UI, không sửa Chat/cache hoặc lưu kết quả nghiên cứu. Xem [thiết kế dữ liệu mẫu](../frontend/design.md#dashboard-số-liệu).

Browser smoke còn kiểm tra 27 bố cục dữ liệu mẫu (ba tab ở chín kích thước), lọc/tính lại tổng, chi tiết, đường độ trễ, đánh dấu tốt hơn và chuyển về dữ liệu phiên không bị trộn fixture. Test logic kiểm tra tổng Hit/Miss/Rejected, usage, độ trễ, bảng/đường/chi tiết dùng cùng số liệu.

## Hydration warning do trình duyệt sửa HTML

Nếu console báo hydration mismatch tại `RootLayout`/`<body>` hoặc `<div>` và diff có thuộc tính lạ như `__processed_…`, `bis_register`, `bis_skin_checked` hoặc class `mdl-js`, hãy kiểm tra extension hoặc công cụ chèn nội dung vào trang. Code ứng dụng không sinh các dấu này. Dòng trong stack là nơi React phát hiện DOM khác với markup dự kiến, chưa xác định được extension cụ thể chỉ từ dòng đó. [Next.js ghi nhận extension sửa HTML là một nguyên nhân hydration mismatch](https://nextjs.org/docs/messages/react-hydration-error).

1. Mở cùng địa chỉ app bằng profile Guest hoặc profile mới không có extension. Nếu dùng cửa sổ ẩn danh/InPrivate, kiểm tra rằng extension không được phép chạy trong cửa sổ đó.
2. Nếu profile sạch không có cảnh báo, trên profile thường mở `chrome://extensions`, `edge://extensions` hoặc `coccoc://extensions`, tắt lần lượt extension có quyền truy cập trang rồi tải lại để xác định thủ phạm. Giới hạn quyền chạy của extension đó trên địa chỉ phát triển đang dùng (`localhost` hoặc `127.0.0.1`), nếu extension hỗ trợ. Với VPN, ngắt kết nối VPN có thể vẫn để content script chạy; cần tắt tiện ích hoặc thu hẹp quyền truy cập trang.
3. Sau khi tắt hoặc giới hạn extension, nhấn `Ctrl+Shift+R` để tải lại. Nếu vẫn lỗi trên profile sạch, xem diff mới để tìm sai khác khác trong ứng dụng.

Đối chiếu trên bản dev ngày 2026-10-27: Chat và Tài liệu không có console error trên profile sạch; mô phỏng chèn thuộc tính trên trước hydration tái hiện cảnh báo; bỏ mô phỏng rồi tải lại Chat hết cảnh báo. Đọc manifest/source extension đã cài trong Cốc Cốc xác định 1ClickVPN Proxy for Chrome (ID `pphgdbgldlmicfdkhondlafkiomnelnk`) khớp ID trong `bis_register` và có script xử lý/chèn `bis_*`; eJOY AI Dictionary (ID `amfojhdiedpdnlijjbhjnhokbnohfdfb`) có content script thêm class `mdl-js` vào html. Cần tắt hoặc giới hạn cả hai rồi kiểm tra lại trên profile gặp lỗi; chưa kiểm chứng thao tác này trên profile cá nhân.

## Kiểm tra

Kiểm tra riêng bundle/materializer trên Windows mà không import driver DB đang bị App Control chặn: từ backend chạy `.\.venv\Scripts\python.exe -m pytest --noconftest tests/repositories/test_repository_snapshots.py tests/repositories/test_filesystem_snapshot_workspace.py -q -p no:cacheprovider`. Đây là unit/memory-authority và filesystem, không thay cho PostgreSQL integration. Nếu sandbox chặn thư mục tạm pytest hoặc tạo junction, dùng terminal local; không tắt policy máy. Full backend vẫn cần runtime Docker và CACHESEC_TEST_DATABASE_URL cho DB test riêng như bên dưới. Staging adapter chưa có HTTP/CLI cho người dùng; root phải được composition tin cậy cung cấp, không tự chọn thư mục app/home.

Trong frontend: `npm run templates:build` sau khi s?a source template, `npm run templates:check` ?? ki?m tra bundle; sau ?? `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Các test dùng Node test runner và đọc TypeScript trực tiếp; dùng Node 24 như môi trường đã kiểm tra. Node có thể cảnh báo tự nhận dạng ES module cho file TypeScript; cảnh báo này không làm test thất bại.

Kiểm tra tương tác và responsive bằng Edge/Chrome headless (không thêm test framework):

```powershell
# Terminal 1, sau npm run build:
npm run start -- --port 3100
# Terminal 2, cùng thư mục frontend:
npm run test:browser
# Tùy chọn: thêm ảnh đối chiếu với bản thiết kế gốc:
npm run test:browser -- --reference
```

Script mặc định tìm Edge/Chrome tại đường dẫn Windows thông dụng. Nếu khác, đặt `BROWSER_PATH` tới executable; `APP_URL` đổi địa chỉ app (mặc định http://127.0.0.1:3100). Ảnh và profile trình duyệt tạm nằm trong `frontend/test-results/browser/`, được Git bỏ qua. Script chỉ đóng process trình duyệt do nó mở; không dùng profile cá nhân. Nếu môi trường chặn tạo process hoặc truy cập DevTools local, cần chạy ngoài sandbox đó.

Thanh nhập và nút Gửi nằm cùng hàng, có cùng thiết kế ở cả ba chế độ. Enter gửi; Shift+Enter xuống dòng. Ô nhập tự giãn khi viết dài và thu gọn sau gửi.

Nhấn **Thông số** ở góc phải (icon biểu đồ trên mobile) để chọn lượt gửi trong hội thoại hiện tại và xem năm trường ở hai cột Không cache/Cache. Mặc định là lượt mới nhất; câu gửi lại vẫn có mục riêng. Nhánh không chạy ghi Không chạy; demo chưa có hit/miss, thời gian hoặc quyết định quyền thật, lượt gọi/token LLM bằng 0 vì chưa gọi model. Đóng bằng Escape hoặc nút đóng.

Browser smoke kiểm tra cả ba chế độ Chat, ba tab Số liệu, Tài liệu và cửa sổ Thông số tại chín kích thước (72 bố cục), cùng chọn lượt mới nhất/cũ/trùng, nhánh không chạy, cập nhật đang chờ, không bịa số đo/quyền, ô nhập/Gửi cùng hàng, giãn nhiều dòng, prompt chung, lịch sử từng nhánh, chọn/thả tệp, từ chối tệp lỗi/trùng, phân loại, tìm/lọc, giữ phiên qua route, redirect và UI kit. Dashboard được kiểm tra chuyển tab bằng phím trái/phải/Home/End, giữ bộ lọc, bảng đối chiếu ba cột với tiêu chí ở giữa, bảng/biểu đồ/chi tiết đúng nhánh, ID không trùng, phân trang, hoàn tất phản hồi khi rời Chat và reset khi reload. Lịch sử sidebar được kiểm tra mở/thu gọn, 5 → 10 → toàn bộ, giữ bản nháp/chọn từ Tài liệu, mobile, bàn phím và giảm chuyển động. Tham số `--reference` chỉ chụp thêm bản xuất gốc để đối chiếu nền thiết kế, không dùng nó làm hợp đồng bố cục hiện tại.

Trong backend:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

Test PostgreSQL thật là opt-in: đặt CACHESEC_TEST_DATABASE_URL trong môi trường terminal tới DB phát triển/test rồi chạy `.\.venv\Scripts\python.exe -m pytest tests/shared/test_postgres_integration.py`. Biến này không đọc từ .env, không mặc định dùng DATABASE_URL của ứng dụng. Test đọc server/extension metadata và round-trip với bảng TEMP chỉ tồn tại trong session; không xóa dữ liệu/bảng app. Không đặt biến thì hai test này skip, không có nghĩa kết nối DB thật đã đạt. Đây là test hạ tầng, không phải fixture thực nghiệm báo giá.

Với cùng biến môi trường, chạy `.\.venv\Scripts\python.exe -m pytest tests/quotation_demo` để kiểm tra domain/application/identity/HTTP/store/migrations. Các test PostgreSQL báo giá tạo database mới tên `cachesec_test_quotations_<UUID>` trên server đã chỉ định; user test cần CREATEDB. Fixture chỉ dọn database do chính nó tạo thành công, không reset/drop database được cấu hình trong URL. Test kiểm tra commit/rollback (kể cả lỗi lúc commit), quyền/thu hồi/replay, retry HTTP song song, cap body thực, migration checksum/concurrency, phân trang và missing/null/ngày sai; dữ liệu này không phải fixture benchmark. Thiếu biến thì phần PostgreSQL skip, phần không cần DB vẫn chạy. Token cố định trong tests chỉ là giá trị test, không phải credential local đang dùng.

`pytest` mặc định kiểm cả app gốc. Các ca khẳng định chưa có rule mới được gắn baseline_only: chạy riêng bằng `-m baseline_only`; sau khi thêm rule, hồi quy chung dùng `-m "not baseline_only"` rồi kết hợp rule suite/fixture đã khóa. Không sửa nhãn mong đợi của fixture để làm bản sửa pass. Browser smoke báo giá riêng hiện cũng kiểm baseline, chưa phải runner đánh giá artifact sau thay đổi; xem [thiết kế đánh giá](../evaluation/design.md#bảng-oracle-t07-để-review).

Frontend dùng package-lock.json để cố định dependencies đã resolve. Python dùng requirements-dev.lock.txt chụp phiên bản môi trường Windows/Python 3.12 hiện tại; requirements-dev.txt mô tả dependencies trực tiếp để cập nhật có chủ đích. Chưa khóa môi trường nghiên cứu hoặc kiểm chứng đa nền tảng, chưa phải môi trường benchmark hoàn chỉnh.

Kiểm tra riêng Báo giá trên trình duyệt: chạy frontend (mặc định runner dùng http://127.0.0.1:3100) với API URL mặc định 8001 và **để trống cổng API 8001**. Trong terminal backend đã đặt CACHESEC_TEST_DATABASE_URL, chạy `.\.venv\Scripts\python.exe -m pytest tests/quotation_demo/browser_smoke.py -q -s`. Đặt CACHESEC_BROWSER_APP_URL nếu frontend ở cổng khác; runner chỉ chấp nhận host local. Runner cấp database ngẫu nhiên riêng, seed 53 record test, sinh hai token test và khởi động API tạm với CORS đúng origin; Edge/Chrome kiểm tra HTTP/PostgreSQL thật, pagination, quyền, kiểu dữ liệu, validate nền, retry sau mất response và responsive; kiểm tra bỏ kết quả validate đến trễ sau đổi/ngắt phiên. Nó dừng API và dọn đúng DB đã tạo khi kết thúc, không dùng/seed/reset DB ứng dụng. Chạy riêng file này theo yêu cầu, không nằm trong lượt pytest mặc định; cần Node, Edge/Chrome và quyền CREATEDB. Lỗi mất response/response đến trễ là fault injection ở transport browser sau fetch thật, không phải số đo hoặc dataset nghiên cứu.

Tài liệu tham khảo: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [FastAPI](https://fastapi.tiangolo.com/), [pgvector](https://github.com/pgvector/pgvector), [Psycopg connection/transaction context](https://www.psycopg.org/psycopg3/docs/basic/usage.html), [PostgreSQL URI và connect timeout](https://www.postgresql.org/docs/17/libpq-connect.html).

## Thành phần đã khởi tạo

- Frontend: Next.js App Router, TypeScript strict, CSS thuần, ESLint và npm lockfile; Chat nội bộ và tiếp nhận/phân loại tài liệu trong phiên trên hệ thiết kế Nói. Chưa có upload hoặc phản hồi AI thật.
- Backend: FastAPI, CORS local/Pydantic Settings, health và PostgreSQL readiness; adapter Psycopg với transaction context, cấu hình secret và timeout; requirements runtime/dev và bản freeze dependencies cho môi trường đã cài.
- Database: Docker Compose với PostgreSQL 17 + pgvector 0.8.7, cổng chỉ bind localhost, persistent volume, init extension vector.
- Báo giá: schema quotation_demo, migration 001/002, domain/application, API tạo/đọc/phân trang/validate nền và PostgreSQL store/session; Bearer fixture reader/operator. UI /quotations dùng HTTP/CORS thật, chưa runtime validation ngày.
- Chưa có authentication production, authority control/reviewer, LLM/embedding provider, cache, schema control/artifact hoặc tích hợp Agent/review/deploy.
- Chưa thêm Dexie/model SDK vì chưa dùng tới; chưa chốt storage server cache.
