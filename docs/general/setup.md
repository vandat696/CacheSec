# Chạy môi trường phát triển

## Phạm vi hướng dẫn

Các lệnh dưới đây chạy frontend, control health/readiness, **API và UI báo giá thật**, cùng Prisma Studio để xem database local; chưa chạy AI Coding Agent, Local Semantic Cache hoặc approval/deployment control. Bối cảnh nghiên cứu đã đổi sang AI-assisted software development ngày 2026-11-02; UI chatbot nội bộ vẫn được giữ để tái sử dụng. Xem [hiện trạng](project-status.md) và [lộ trình PoC](implementation-plan.md).

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

Migration 002_control_authority.sql thêm repositories/scope_authorities/principals/principal_grants; chạy cùng CLI control ở trên. Không seed repo/principal/token/grant hoặc tự áp migration khi mở API. Registry Python ở app.identity cung cấp RepositoryAccessService và PostgresControlAuthorityTransactions; thành phần tin cậy quản trị qua PostgresAuthorityAdministration trong database.connection(), giữ transaction đến commit. Cấu hình cần UUID tenant/repo/principal, repository identity, token digest/version, capability tường minh và expected_epoch. Chưa có file cấu hình/CLI cấp quyền, startup sync hoặc HTTP registry; không tái sử dụng reader/operator token làm cấu hình control. [Quyền và giới hạn](../system/authorization.md#registry-control-nội-bộ-đã-triển-khai) sở hữu contract này.

Chưa có API/UI upload/read blob hoặc artifact-ready. Hash/index row không cấp quyền hoặc xác nhận bytes là source/test/artifact hợp lệ; registry chưa cấp quan hệ scoped cho blob. Dev DSN owner/superuser vẫn có thể truy cập bảng; runtime roles/host ACL/sandbox cần được provisioning trước chạy code không tin cậy. Cơ chế publish/commit/orphan và giới hạn power-loss/host race ở [kiến trúc storage](../system/architecture.md#nền-blob-control-đã-triển-khai).

Kiểm tra `.\.venv\Scripts\python.exe -m pytest tests/artifacts tests/identity tests/control -q` và đặt CACHESEC_TEST_DATABASE_URL nếu muốn phần DB thật. DB test dùng prefix cachesec_test_control_<UUID>, báo giá vẫn cachesec_test_quotations_<UUID>; helper chỉ dọn DB nó tạo thành công, không reset DB từ URL. Filesystem tests dùng thư mục tạm; sandbox Windows có thể từ chối thư mục private của pytest, cần lượt ngoài sandbox để kiểm chứng. Không sửa ACL máy hoặc coi lượt lỗi quyền/skip là đã pass. Không có GC/reset tự động cho kho app.

## 3. Frontend (terminal khác)

```powershell
cd frontend
npm ci
npm run dev
```

Mở http://127.0.0.1:3000/workspace để xem **Developer Workspace** theo bố cục IDE: code bên trái, chat Agent bên phải; màn nhỏ xếp dọc. Chat bắt đầu trống; gửi yêu cầu để xem phản hồi mẫu. Chuyển Diff/Bản gốc trong vùng code. Nút Kiểm thử và Phê duyệt trên toolbar mở hộp thoại; Escape hoặc nút đóng quay lại code/chat. Xem kết quả mẫu, chọn vai trò người duyệt và xác nhận đúng diff để duyệt bản mẫu. Mở Mã mẫu · Chỉ đọc rồi Thử bản sửa khác để thấy phê duyệt cũ mất hiệu lực. Nhật ký nằm thu gọn trong Phê duyệt; nút Triển khai luôn khóa. Không đọc repository, gọi AI, chạy test nghiệp vụ hoặc thực thi gate backend. Rời trang hoặc reload sẽ reset mẫu.

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
