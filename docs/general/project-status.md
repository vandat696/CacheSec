# Trạng thái dự án

## 2026-11-14 — Chuyển Agent sang Gemini

- Theo yêu cầu người dùng, thêm adapter Gemini generateContent, provider mặc định `gemini`, key private `gemini.env`; giữ adapter/key OpenAI riêng và chỉ chọn qua cấu hình backend. Prompt/schema, validation kết quả và transport giới hạn dùng chung; service lấy model ID từ adapter, UI hiển thị đúng model/key setup và lỗi trung lập provider. Không thêm SDK, quyền, schema hoặc tự fallback.
- Gemini 3.8 Flash có trong danh sách model của key nhưng các lượt generation trả 503 quá tải. Chọn cố định `gemini-3.5-flash-lite` cho bản tích hợp cuối: lượt phân tích qua assistance API thật trả 200, tiếng Việt, content=null, usage 1973 input/110 output/2083 total. Đây là smoke kết nối, không phải benchmark; source validation gốc không đổi. Không tuyên bố model đã kiểm chứng khả năng sửa rule ngày hoặc correctness nghiên cứu.
- **Kiểm chứng:** 398 test backend với PostgreSQL Docker tạm cô lập và 103 test frontend đạt; Ruff lint/format, ESLint, typecheck/production build đạt. Edge bản cuối đạt UI Agent với generation double có nhãn, proposal/revision/test Docker thật, draft/disconnect và ba cỡ 390/820/1440. API/Workspace local đã restart bản mới. Còn cảnh báo TestClient/httpx và Node module detection có sẵn; chưa kiểm browser/OS khác.
- Hồi quy phát hiện claim launch bằng rename có thể cho hai consumer cùng thành công trên Windows. Đổi sang tạo claim rỗng exclusive `wx`, giữ tombstone và xóa launch record; regression 20 lượt × 8 consumer trên hai store instance đạt. Claim/session cũ vẫn chưa GC tự động. Các lượt test lỗi sandbox/quyền file và race trước sửa không được tính là đạt.
- Smoke `--agent-live` qua browser đã chuẩn bị nhưng chưa chạy: automatic approval review chặn gửi ba source file tới Google vì yêu cầu chấp thuận rõ payload/đích bên ngoài. Không lách bằng lệnh khác; bước này chờ người dùng cho phép. Đã nhắc thu hồi key từng gửi vào hội thoại và lưu key mới trực tiếp; không ghi key vào repo/log/tài liệu. Cập nhật setup/API/bảo mật/kiến trúc/frontend/source map/lộ trình/README. Cache/gate và điều kiện nghiên cứu giữ nguyên.

## 2026-11-14 — Khởi động lại stack để dùng Agent thật

- Đã mở Docker Desktop và chạy launcher local hiện có: PostgreSQL, control API, app báo giá, worker và Workspace khởi động thành công. Control readiness và Workspace trả HTTP 200; sau khi người dùng lưu key private, API Agent được xác thực trả model `gpt-6.1-sol`, mode `assisted`, `configured=true`.
- Ba test frontend của Agent đạt; còn cảnh báo Node module detection có sẵn. Không đổi code ứng dụng, quyền hoặc schema và không chạy lại toàn bộ suite/backend/browser.
- Snapshot thật trả 201; yêu cầu phân tích qua assistance API gọi provider thật nhưng trả `MODEL_RATE_LIMIT`. Một probe Responses tối thiểu xác định OpenAI trả HTTP 429, `credit_balance_exhausted` / `insufficient_quota`: tổ chức của key không còn prepaid credits. Chưa có phản hồi model thành công; bước tiếp theo là người dùng xử lý credits trên OpenAI Platform rồi kiểm lại một lượt assistance thật. Không ghi key/nội dung lỗi provider vào tài liệu hoặc thay model để né lỗi. Cache/gate và điều kiện nghiên cứu giữ nguyên.

## 2026-11-12 — Một phiên local cho Workspace và Báo giá

- Theo yêu cầu bỏ nhập lại token/ID, owner launcher mới mở cả hai màn bằng cùng phiên HttpOnly tối đa 8 giờ. Next dùng riêng credential dev control và fixture operator báo giá đã có, chỉ ở server; helper sinh `quotation-access.json` private, không đổi grants/registry/DB schema. Cookie control cũ phải mở lại bằng launcher một lần, không tự nhận quyền mới; rotation/revoke báo giá không chuyển danh tính control, logout local đóng hai màn.
- Route group giữ editor/undo, chat và form khi đổi `/workspace` ↔ `/quotations`. UUID proposal/báo giá giữ trong URL, reload tải lại dữ liệu đã lưu qua backend có kiểm quyền; không lưu token/source/chat trong browser storage. Draft chưa lưu không khôi phục sau reload. Manual Bearer vẫn là mục nâng cao.
- **Kiểm chứng:** 99 test frontend, 3 test helper Python, Ruff lint/format theo config backend, ESLint và production build/typecheck đạt. Edge thật đạt tự kết nối hai màn, không hiện ô token, giữ draft/form khi điều hướng, reload khôi phục cả proposal và báo giá, logout xóa cả hai và reload vẫn ngắt. Dataset dev ban đầu rỗng nên smoke tạo một báo giá giả có nhãn `Local session navigation check`; chỉ thêm proposal/revision kỹ thuật, không đổi source gốc/triển khai. Lượt browser đầu lỗi helper thiếu focus trước Ctrl+S; sửa helper và lượt cuối đạt. Không chạy lại backend suite vì không đổi backend app/domain/API.
- Cập nhật setup, phân quyền, frontend và source map. Frontend mới đang chạy loopback 3000; quotation baseline vẫn chưa có rule ngày, Agent/key/cache/gate và các điều kiện nghiên cứu giữ trạng thái trước đó.

## 2026-11-12 — Thu gọn thông tin phụ trong Workspace

- Theo yêu cầu người dùng, bỏ nhãn Bản làm việc riêng ở toolbar và footer editor; giữ Chỉ đọc khi cần. Gom model, trạng thái/hướng dẫn API key, tải lại cấu hình, số file source và ghi chú kiểm tra kết quả vào nút ⓘ ở góc phải Agent. Chat mặc định trống, không có nhãn/hướng dẫn/nguồn lặp; giữ tên truy cập cho ô nhập, thông báo lỗi thao tác và khóa gửi khi chưa cấu hình. Tiêu đề tab rút thành Workspace · CacheSec.
- Popup hỗ trợ Escape, click ngoài, Tab/focus và mở lên trên ở màn nhỏ để không tràn viewport. ESLint, typecheck, production build và Edge đạt thao tác popup/giữ draft/áp dụng/test ở ba cỡ 390/820/1440; generation vẫn là double có nhãn, revision/Docker thật. Thời gian chờ riêng job trong browser harness tăng 15 lên 60 giây sau khi worker đã pass nhưng UI check hết hạn sớm. Không đổi backend/API/quyền/model, không chạy lại suite backend cho thay đổi UI này.
- Cập nhật thiết kế frontend/setup. Các dòng Beta/0 / 0 lượt/image/svg người dùng chép không tìm thấy trong source Workspace; không thêm bộ đếm hoặc hạn mức giả. Tình trạng key/provider, cache/gate và nghiên cứu giữ nguyên mốc trước.

## 2026-11-12 — Một Workspace và Agent GPT-6.1 Sol

- Người dùng yêu cầu một màn IDE chính, đưa mô phỏng ra khu phụ và chọn `gpt-6.1-sol`; đã xác minh model ID bằng OpenAI Docs. Workspace hiện ghép editor/Explorer/revision/diff/test và khung Agent ẩn/hiện được, giữ draft. Mô phỏng chuyển tới `/ui/workspace-preview`, mở từ UI templates; source/state mẫu tách khỏi phiên thật, không xóa frontend cũ.
- Thêm generation contract/adapter Responses API, assistance service và HTTP `/api/v1/agent/config|messages`. Human khởi tạo request; backend kiểm identity/scope, bundle đúng ba file, source profile/hash trước/sau model và quyền sau response. Model không có tool hoặc credential human; chỉ trả answer/suggestion nullable cho validator, usage có thật hoặc null. Người dùng áp dụng qua proposal API, xem diff rồi chạy Docker test; có guard draft trước lưu và khi response mở proposal. Không cấp quyền mới, không tự ghi working tree hoặc approve/deploy.
- Người dùng chọn tự đặt key trong `backend/.local/agent-config/openai.env`; đã tạo file trống private, không ghi đè file có sẵn. Launcher thêm mount read-only cấu hình riêng vào control, không vào Next/app/candidate/harness/image; đọc lại key khi dùng. **API dev hiện trả configured=false; chưa chạy lượt OpenAI thật vì chưa có key.** Không lấy credential Codex/ChatGPT của host hoặc tự thay model. Adapter store=false, không tự retry, endpoint cố định, không redirect/proxy môi trường; lỗi/usage/refusal/incomplete không giả thành công.
- **365 test backend với PostgreSQL Docker riêng và 95 test frontend đạt; Ruff/lint/format, ESLint, typecheck và production build đạt.** Backend kiểm deny trước provider, snapshot sai, revoke/source đổi trước hoặc trong generation và lỗi schema/provider bằng double có nhãn. Edge đạt flow Agent với generation double, proposal/revision/Docker test thật, Hủy/Không lưu giữ draft đúng, disconnect xóa chat/source và ba cỡ 390/820/1440; preview hồi quy 16 bố cục đạt. Đã rà ảnh desktop/mobile. Các lượt đầu lỗi helper CodeMirror virtualization không được tính là pass; lượt cuối đầy đủ đạt. DB/mạng test tạm đã dọn đúng labels, DB dev/source validation/fixture/quyền/migration giữ nguyên.
- Cập nhật setup/frontend/API/authorization/architecture/source map/lộ trình/README. Đây là assistance cần human áp dụng/test; chưa Agent tự điều phối/delegation, cache, gate hoặc nghiên cứu, chưa hoàn thành toàn T09/T14/T15. Context hiện là source gốc snapshot, không gồm draft editor; chat chưa lưu bền hoặc audit nghiên cứu. Bước tiếp theo để dùng model: điền key private, tải lại cấu hình Agent và kiểm lượt provider thật; các điều kiện nghiên cứu/gate còn mở giữ nguyên.

## 2026-11-12 — Workspace tự kết nối bằng phiên local

- Người dùng đã chọn phiên local tối đa 8 giờ bằng danh tính dev hiện có. Thêm `npm run local` để mở stack/project và `npm run workspace` để chỉ mở project khi dịch vụ đã chạy; launcher PowerShell dùng cùng helper. Mở Workspace không cần dán token, reload/quay lại dùng phiên còn hạn; kết nối Bearer nâng cao giữ trong mục thu gọn. Quyền read/propose/test, registry, source profile và realm báo giá/worker giữ nguyên; không thêm Reviewer/deploy.
- Capability mở project ngẫu nhiên 256 bit, dùng một lần/60 giây qua fragment rồi xóa; đổi sang cookie HttpOnly và session record private có expiry tuyệt đối, logout và credential binding. Token dài hạn chỉ đọc ở Next server, không đưa vào browser/URL/argv. Proxy chỉ allowlist repository/changes read/propose/test tới backend cố định, giữ kiểm quyền mỗi thao tác; chặn origin/Host/Fetch Metadata khác, admin/worker/approval/deploy, URL tùy ý và redirect. Có ca tái hiện NextRequest chuẩn hóa loopback để không từ chối nhầm origin hợp lệ.
- **92 test frontend, ESLint, typecheck, production build và parse PowerShell đạt.** Edge thật đạt mở tự động, Ctrl+S, revision/test Docker pass, reload, hủy phiên, replay bị chặn và liên kết mới mở lại. Hồi quy Bearer dev đạt ba file host và ba cỡ 390/820/1440. Quét 426 file build server/static không thấy token dev hoặc private data trong trace. Launcher thật bật/reuse DB/control/báo giá/worker/frontend; không chạy lại suite backend vì không đổi backend/schema/domain. Các lượt browser lỗi trong quá trình sửa helper/normalization không được tính là pass; lượt cuối đạt đầy đủ.
- Cập nhật setup, thiết kế frontend, API/authorization, workflow, source map và README. Giới hạn: Windows/Node 24.21.0, origin cố định `http://127.0.0.1:3000`, host/local services/Next và browser cùng origin tin cậy; HTTP dev không dùng cho LAN/production. Session hết hạn chưa GC tự động; logout chỉ hủy phiên được chọn, bản nháp chưa lưu không khôi phục sau reload. Màn Báo giá vẫn có token realm riêng. Chưa Agent/cache/gate hoặc nghiên cứu; source validation gốc không đổi.

## 2026-11-12 — Rút gọn Workspace để thao tác sửa/test

- Theo phản hồi giao diện khó dùng, rút luồng chính thành nhập token → Mở Workspace → editor file validation sẵn → Lưu và kiểm thử. Tự capture/read sau xác thực, vẫn kiểm identity/hash và abort response cũ; nguồn profile khác vẫn đọc thủ công. Thay path dài bằng nhãn file ngắn, mở sẵn kết quả mới nhất, lỗi tiếng Việt, ẩn ID/hash trong details và ẩn nút test/approval mô phỏng khỏi chế độ thật. Không rewrite frontend cũ hoặc thay backend/permission/token storage.
- Tách coordinator save/test có retry key theo payload/artifact: giữ revision đã commit khi test request lỗi, retry save hoặc job dùng lại đúng key; hủy phiên không khôi phục source. Nút Chỉ lưu và mở nguồn/bản sửa cũ giữ lại. Token vẫn nhập theo phiên; không nhúng secret vào frontend hoặc thêm cơ chế tự cấp quyền.
- **81 test frontend, ESLint, typecheck và production build đạt.** Edge thật đạt luồng mới, ba revision Docker pass/fail/timeout, verdict cũ đúng bản, đọc/mở lại snapshot, token không lưu browser storage và bố cục 390/820/1440. Thêm test mất ACK save/test và cancel; không chạy lại backend vì không đổi implementation/contract backend. Cập nhật thiết kế frontend, setup và workflow; source nghiệp vụ, Agent/cache/gate và điều kiện nghiên cứu giữ nguyên.

## 2026-11-12 — Mở stack local bằng một lệnh

- Theo yêu cầu mở các thành phần cùng lúc để test, thêm `scripts/start-local.ps1`: bật DB, control + override T12, app báo giá baseline trên Docker, worker và frontend; `-Studio` bật Prisma Studio, mặc định mở browser Workspace. Reuse dịch vụ đang có và khóa launcher tránh hai lượt khởi động đồng thời; process mới chạy nền với log private. Không tự migrate/provision, tạo secret, đổi grants, build lại runtime app hoặc kích hoạt candidate.
- Quotation API dùng đúng runtime image ID/platform trong profile đã đăng ký, không bind working tree. Kiểm profile khớp control trước mở app, từ chối thay image baseline đã tồn tại. Helper kiểm DSN app thuộc Compose DB local trước khi đổi hostname/port, chỉ đưa DSN/two fixture tokens vào env app; giữ `.env` gốc và credential control/worker riêng. Base control và DB Compose không đổi, thêm project Compose báo giá riêng trên loopback 8001.
- **Kiểm chứng:** ba unit test cấu hình đạt, Ruff lint/format và parse PowerShell đạt. Chạy launcher thật: lần đầu thêm app báo giá, lần sau reuse đủ DB/API/worker/frontend và khởi động Studio; kiểm lại bản cuối không thêm process. Control workflow GET và quotation GET với identity hiện có đạt, ba container healthy, Studio chỉ listen 127.0.0.1:5555. Chưa thử máy Windows khác hoặc cold-start lại frontend/worker hiện có; không dừng các phiên đang dùng chỉ để test launcher. Không chạy lại toàn bộ test ứng dụng vì không đổi domain/API/frontend.
- Cập nhật README/setup/source map. Docker Desktop và môi trường đã provisioning vẫn là điều kiện đầu vào; frontend dùng build sẵn, worker lock không thay heartbeat, chưa có lệnh stop chung. T13/Agent/cache và điều kiện nghiên cứu giữ trạng thái trước đó.

## 2026-11-12 — Hoàn thành mốc tích hợp T12 local

- Người dùng đã xác nhận trọn gói T12: chỉ sửa `quotation_validation.py` trong candidate riêng, giữ profile đọc ba file, cấp dev đúng read/propose/test, dùng worker Docker/DB test riêng và kết quả thật trên Workspace. Đã triển khai snapshot → editor → revision/diff → test → evidence, không dừng ở helper; working tree validation vẫn là baseline. Mốc tích hợp kỹ thuật hoàn tất; T12 toàn bộ theo điều kiện nghiên cứu còn phụ thuộc oracle/fixture/trusted R chưa khóa.
- `app.change_workflow` lưu revision/patch/artifact/job/evidence và idempotency trong cùng authority transaction; CAS chặn revision cũ, kiểm lại identity/version/hash/grants/profile/source/artifact tại test permit. API public không nhận path/command/image/mount hoặc test verdict; private worker credential/ticket không đưa browser/candidate. Lỗi/commit failure không trả giả thành công; terminal evidence không ghi đè.
- Worker host riêng dùng stdlib/Docker CLI, không import psycopg hoặc tắt App Control. Image runtime app, harness và DB ghim ID/platform/inventory; overlay model/service khớp inventory, chỉ validator được thay. Mỗi job có internal network, DB mới và role không DDL, non-root/read-only app, ba mount file RO, resource/output/deadline limits. Probe thực tế chặn Internet/control/DB host; candidate không có control store/socket/credential. Worker lock, owned-job recovery, report retry và cleanup theo exact worker/job labels; staging/private test credential giữ lại, chưa GC.
- **355 test backend với PostgreSQL thật trên Docker Linux đạt, không skip; 6 test worker native Windows đạt; 78 test frontend, Ruff lint/format, ESLint, typecheck và production build đạt.** Năm ca executor thật trên profile cuối đạt kết quả mong đợi: pass, lỗi validator, timeout, output limit và isolation/DB privilege. Browser Edge đã kiểm toàn luồng thật, ba revision pass/fail/timeout, verdict cũ không gán sang revision mới, token không lưu browser storage và bố cục 390/820/1440. Cảnh báo TestClient/httpx và Node module detection có sẵn còn; chưa kiểm browser/OS khác.
- Dev áp dụng migration 004, kiểm history/checksum cũ và dữ liệu app/registry/source profile trước/sau provisioning giữ nguyên. Epoch cuối 9, dev chỉ có `repository.read`, `proposal.create`, `test.run`; không reviewer/deploy. Lượt smoke dev đầu bị lỗi setup được giữ nguyên là error; các lượt sau dùng profile đã sửa và kiểm chứng, không ghi lại thành pass. Control Docker loopback 8000, frontend 3000 và worker riêng đã chạy. Base Compose read-only giữ độc lập; T12 thêm override profile mount.
- Cập nhật [workflow T12](../system/change-workflow.md), setup/API/architecture/authorization/source map, frontend/README/lộ trình. Chưa chạy Agent, cache hoặc nghiên cứu; chưa thêm rule ngày vào source gốc hoặc kích hoạt candidate. Tiếp theo là gate T13 gắn đúng artifact/evidence theo thiết kế; oracle/one-fixture contract, trusted R và acceptance nghiên cứu vẫn còn mở. Host/Docker owner vẫn tin cậy; sandbox probes không chứng minh chống mọi container escape, chưa có distributed worker lease hoặc automatic GC.

## 2026-11-11 — Bundle đầy đủ và source staging cho bước artifact

- Theo yêu cầu tiếp tục, thêm read_bundle nội bộ: xác thực/kiểm repository.read và active profile, đọc canonical metadata cùng mọi payload dưới một authority transaction/lock, chỉ trả sau commit. SnapshotBundle kiểm schema/profile/manifest, exact paths/caps và digest/size; bytes binary/LF/CRLF/file rỗng giữ nguyên, không đưa payload vào repr. get HTTP vẫn chỉ là metadata; không mở endpoint bundle hoặc cấp capability mới.
- Thêm FileSystemSnapshotWorkspace prepare/verify trong root host tường minh: mỗi lần thư mục riêng, file ghi exclusive và đọc lại; chặn entry ngoài manifest, nội dung đổi, alias/reparse/junction và hard-link. Không sửa working tree hoặc overwrite workspace cũ, không chạy source; PreparedSnapshot là vị trí nội bộ, không phải quyền/artifact-ready. Host/control vẫn có thể sửa staging; verify không thay current authorization, source freshness hoặc binding runtime. Không GC tự động; lỗi có thể để directory chưa được tham chiếu mà không trả receipt thành công.
- **337 test backend với PostgreSQL thật trong Docker Linux đạt, không skip; 32 test unit/memory-authority/filesystem native Windows đạt; Ruff lint/format đạt.** Có adapter thay thế, deny trước I/O, profile cũ, mọi file payload, bundle/tệp bị sửa, binary/empty, preparation song song, Windows junction thật, authority lock suốt đọc và lỗi COMMIT PostgreSQL thật không trả bundle. Native unit dùng --noconftest vì không cần DB driver; không coi đây là đã gỡ blocker DLL psycopg Windows. Cảnh báo TestClient/httpx sẵn có còn.
- Build/cập nhật image control dev, probe read_bundle → staging → verify bằng token chỉ đọc và snapshot dev sẵn có đạt ba file; chỉ tạo bản sao /tmp riêng rồi dọn, không import/chạy source báo giá. Counts/epoch/grants/migration checksums trước/sau probe giữ nguyên; không đổi SQL, .env, source profile hoặc quyền. Không chạy frontend/browser vì không đổi UI/HTTP contract. Container DB/network test riêng được dọn; giữ control/DB dev hiện có.
- Cập nhật API/architecture/authorization/source map, setup/lộ trình và README. Đây là đầu vào chuẩn bị cho artifact/harness, **chưa hoàn tất T12**: cần source/dependency profile đầy đủ, runtime image/lock/config/launcher profile và harness/fixture được đăng ký tin cậy trước thực thi. Profile dev vẫn ba file; chưa proposal/patch, artifact-ready, test evidence, gate/activation, Agent/cache hoặc thực nghiệm nghiên cứu. Các điều kiện oracle/R/acceptance/protocol vẫn mở như trước.

## 2026-11-11 — Bật luồng snapshot trên môi trường dev

- Theo yêu cầu tiếp tục, review/profile đúng ba file business báo giá và đăng ký một repository/principal/profile dev. Principal mới chỉ có repository.read; token ngẫu nhiên độc lập app báo giá lưu riêng trong .local, không in hoặc đưa vào Git/argv/frontend bundle/API mount. ACL thư mục private giới hạn tài khoản hiện tại và SYSTEM; không thay backend/.env hoặc secrets PostgreSQL cũ.
- Native psycopg vẫn bị Windows App Control chặn libcrypto; event 3077 ghi policy VerifiedAndReputableDesktop và năm file DLL/PYD khớp hash RECORD, không phát hiện hỏng bytes package. Người dùng đã xác nhận chọn Docker local cho API control dev, dùng lại PostgreSQL hiện có và giữ chính sách Windows. Đây không phải native Windows đã sửa hoặc quyết định sandbox/gate nghiên cứu.
- Thêm Dockerfile.control/.dockerignore và compose project riêng dùng DB/network hiện có. Image ghim Python digest/dev lock, loại host secrets/venv/.local/test; runtime UID/GID 10001, rootfs read-only, drop ALL/no-new-privileges, chỉ mount ba source file read-only. API loopback 8000, frontend production loopback 3000 được giữ chạy để dùng thử. Runtime control là code tin cậy, bridge chưa chặn egress và dev DSN chưa có DB role isolation; chưa cho code Agent chạy ở đây.
- **Kiểm chứng dev thật đạt:** health/readiness/registry/capture/get/file; bytes/hash/size ba file khớp host; CORS/no-store/anonymous 401 và token khác realm báo giá. Revoke capability của đúng principal mới làm describe/get/file trả 403 không data, restore bằng epoch CAS trả 200; epoch cuối 5. Restart control giữ epoch/grants/snapshot, không seed lại quyền. Sau kiểm tra có 1 repo, 1 principal, 1 profile, 2 snapshot và 5 blob dedup; app/retry hashes và hai migration histories khớp baseline trước cấp quyền, không đổi SQL/checksum hoặc dữ liệu báo giá.
- Edge qua frontend → HTTP Docker publish loopback → PostgreSQL dev trực tiếp đạt ba cỡ 390/820/1440; tạo một snapshot thật, mở lại sau kết nối, hiển thị đúng source host và xóa UI khi ngắt. Thêm --repository-dev riêng; không dùng token/data dev cho harness test giả. ESLint/typecheck, Compose config/build, Ruff lint/format và rà diff/link đạt. Không chạy lại suite 312 backend/73 frontend hoặc build frontend vì không đổi logic app/UI/dependency; kết quả suite đầy đủ gần nhất thuộc mốc trước, native Windows vẫn chưa kiểm chứng.
- Cập nhật README, setup, API/architecture/authorization/source map và lộ trình. Hoàn tất lát cắt bật luồng đọc dev; tiếp theo artifact/harness và gate theo dependency/thiết kế đã chọn. Source write/Agent/cache, oracle/fixture/R và acceptance/protocol nghiên cứu còn mở; chưa thêm rule ngày, phê duyệt hoặc kích hoạt artifact, chạy thí nghiệm so sánh.

## 2026-11-11 — HTTP snapshot và Workspace đọc source

- Nối registry/snapshot vào control HTTP: describe repository, capture/get snapshot và read file bằng ID. Bearer control lấy scope từ principal DB, service snapshot kiểm quyền/profile lại trong transaction trước I/O; không nhận path/root/role/scope từ browser. Response v0.2/OpenAPI, request ID, no-store, CORS và lỗi đã sanitize; bytes base64 giữ binary/LF/CRLF, chưa capture idempotency hoặc source write.
- Thêm JSON binding host tường minh, profile mẫu ba file business báo giá và CLI configure_repository. Mặc định chỉ kiểm cấu hình; --apply cấp duy nhất repository.read với expected_epoch/credential version, repo/principal/profile cùng transaction. Token qua getpass, từ chối fallback nhập có echo; không tự sync/seed quyền khi worker startup. CLI thay grants của principal được chỉ định thành read-only, cần principal riêng nếu muốn giữ quyền Reviewer hiện có.
- Workspace mặc định đọc Repository thật: kết nối token trong bộ nhớ, tạo/mở snapshot và chọn file; kiểm ID/bytes/hash trước hiển thị UTF-8, binary báo rõ. Chế độ workflow mẫu được giữ riêng, không nhận source/token thật; test/approval/Agent chưa thực thi. Đổi/ngắt phiên và lỗi tải xóa source; response cũ không khôi phục phiên. CRLF chỉ chuẩn hóa khi hiển thị, bytes lưu/HTTP giữ nguyên; không polling để thu hồi nội dung đã đọc.
- **312 test backend với PostgreSQL thật trong container Linux đạt, không skip; 73 test frontend, Ruff lint/format, ESLint, typecheck và production build đạt.** Gồm revoke giữa HTTP scope resolution và capture, deny/chéo scope, body/query injection, tamper/profile cũ, epoch conflict/rollback và input token không echo. Windows native bị Application Control chặn DLL psycopg cả ngoài sandbox; không sửa chính sách máy hoặc coi Linux là kiểm chứng native Windows. Cảnh báo TestClient/httpx và Node module detection có sẵn còn.
- Edge kiểm tra HTTP/PostgreSQL test thật qua proxy loopback → docker exec → HTTP container; API/source trên mạng Docker nội bộ không Internet. Kiểm tra kết nối/quyền, capture/mở snapshot, bytes/binary, response đến trễ và denial injection xóa source; ba cỡ 390/820/1440 đạt. Hồi quy workflow mô phỏng, keyboard/modal và 16 bố cục đạt. Đã rà ảnh source desktop/mobile; lỗi 403/response trễ trong browser là fault injection, revoke thật được kiểm ở HTTP/DB. Đây là kiểm chứng phát triển, chưa phải fixture hoặc run nghiên cứu.
- Cập nhật README, API/architecture/authorization/source map, frontend/setup/lộ trình. Không đổi SQL/checksum, .env, DB ứng dụng hoặc cấp token/profile dev; hạ tầng test tạm được dọn sau kiểm tra. Tiếp theo review/đăng ký nguồn dev bằng CLI và xử lý blocker DLL host, rồi artifact/harness/gate theo dependency. Snapshot chưa có Git/base revision, dependency completeness hoặc artifact-ready; Agent/cache, oracle/fixture/R và acceptance/protocol nghiên cứu còn mở.

## 2026-11-09 — Snapshot repository có kiểm quyền

- Theo yêu cầu thực hiện snapshot, thêm app.repositories: exact-file SourceProfile/root binding, filesystem capture hai lượt, snapshot/file models và capture/get/read_file service qua ports. Chỉ file trong profile backend tin cậy được đọc; chặn traversal/ADS/case alias/secret paths phổ biến, symlink/junction/reparse và hard-link. Bytes binary/LF/CRLF giữ nguyên; snapshot đã lưu không đổi khi source được sửa. Profile không phát hiện secret trong nội dung hoặc chứng minh capture nguyên tử trước host race.
- Migration 003 thêm repository_source_profiles/snapshots/snapshot_files và FK blob digest/size. Source profile administration kiểm epoch/identity dưới cùng authority lock; service kiểm digest active từ DB để chặn worker cũ. Authority/index/snapshot chung transaction, chỉ trả sau commit; lỗi có thể để orphan bytes, chưa có capture idempotency. Điều chỉnh raw blob register thành ON CONFLICT DO NOTHING rồi đối chiếu ref để xử lý cả hai unique index khi publish song song.
- **302 test backend với PostgreSQL thật đạt, không skip; Ruff lint/format đạt.** Bao gồm deny trước I/O, sai scope/file ID, nguồn đổi, cap, adapter thay thế, snapshot/bytes tamper, migration upgrade, rollback và lỗi COMMIT thực, profile freshness/lock, hard-link và Windows junction thật. Đã sửa ca tái hiện lstat/fstat ctime khác trên Windows bằng đối chiếu ctime trên cùng handle; không bỏ kiểm identity/hash/hai lượt đọc. Một lượt test DB timeout tạm thời; DB ngẫu nhiên đúng của lượt đó đã được dọn khi không còn session, lượt toàn bộ cuối đạt. Cảnh báo TestClient/httpx sẵn có còn; không chạy frontend/browser vì chưa đổi HTTP/UI.
- Áp dụng migration 003 lên DB dev loopback; CLI replay no-op. So trước/sau toàn bộ rows app/retry, registry, blob và history/checksum cũ giữ nguyên; ba bảng mới đều 0 row. Không sửa .env, seed profile/quyền hoặc capture source thật; SQL migration cũ giữ nguyên. Source/store test nằm trong thư mục tạm, database test riêng được dọn.
- Cập nhật README, architecture/API/authorization, setup, source map và lộ trình. Snapshot là nguồn bytes theo allowlist, chưa có Git/base revision, dependency/runtime/test completeness hoặc artifact-ready. Tiếp theo review profile nguồn thật và nối snapshot đọc qua control HTTP/Workspace với identity transport; chưa source write/Agent/gate hoặc nghiên cứu. T03–T08 toàn hệ thống, oracle/fixture/R và acceptance vẫn còn phần mở.

## 2026-11-09 — Registry quyền và repository control nội bộ

- Theo yêu cầu tiếp tục, triển khai app.identity: ControlAuthorizer kiểm identity/grants hiện tại, RepositoryAccessService đọc metadata registry qua transaction port, PostgreSQL authority adapter và backend administration có expected_epoch. Token control độc lập app báo giá; registry không có principal/grant mặc định hoặc API đổi quyền cho browser/Agent. Chưa nối HTTP/UI hoặc startup sync cấu hình.
- Migration control 002 thêm repositories/scope_authorities/principals/principal_grants, khóa/FK ghép tenant/repo, credential version/digest và capability tường minh. Grant/revoke/rotation dùng chung authority row lock với authorize; credential cũ bị chặn, cấu hình epoch cũ conflict thay vì ghi đè. Đây là identity fixture backend cho PoC, chưa phải IAM production hoặc gate.
- **244 test backend với PostgreSQL thật đạt, không skip; Ruff lint/format đạt.** Có ca adapter thay thế, deny/sai scope, revoke/disable/rotation, caller cũ, quyền Reviewer tường minh cho cùng human, rollback, migration nâng từ blob-only, cấu hình song song và lock giữ đến commit. Bộ test toàn backend vẫn có cảnh báo TestClient/httpx sẵn có; không chạy frontend/browser vì không đổi HTTP/UI.
- Đã áp dụng 002 lên DB dev loopback; replay no-op. So trước/sau: dữ liệu báo giá/retry, history/checksum migration cũ và blob index giữ nguyên. Bốn bảng registry đều 0 row; không seed token/quyền hoặc sửa .env. DB test ngẫu nhiên riêng được dọn; không thay SQL migration 001 control hoặc 001/002 quotation.
- Cập nhật README, architecture/authorization/API, setup, source map và lộ trình. Tiếp theo repository path/allowlist profile và snapshot refs có quyền; sau đó artifact/harness/gate. Chưa có snapshot/source read/write, Agent delegation, policy epoch riêng, event audit bền vững hoặc runtime DB role isolation. T03–T06 toàn hệ thống chưa hoàn tất; chưa thêm rule ngày, kích hoạt artifact, khóa fixture/acceptance hoặc chạy thực nghiệm.

## 2026-11-09 — Chọn local v0.1 và triển khai nền blob/control storage

- Người dùng yêu cầu tiếp tục sau khi review gói local v0.1; ghi nhận chọn thiết kế authority/freshness, approval 30 phút/single deployment, storage và Docker/target/recovery đã trình bày. Đây là quyết định triển khai PoC của người dùng, không phải acceptance của cô hoặc approval cho một artifact. Chưa chạy Agent hoặc kích hoạt code mới.
- Thêm app.artifacts: encoder cachesec-json-v1, raw blob ref/service/ports, filesystem publish no-overwrite và PostgreSQL index/transaction adapter; control factory cần DSN/root tường minh. Migration control 001_artifact_blobs.sql tạo index bytes, không tạo trước bảng scope/approval/gate chưa dùng. Dùng chung mechanics migration với quotation qua shared/postgres_migrations.py, giữ public wrapper, lock/schema/history riêng và SQL/checksum báo giá cũ.
- **216 test backend với PostgreSQL thật đạt, không skip; Ruff lint/format đạt.** Test kiểm binary/LF/CRLF, vectors encoder, giới hạn đầu vào, tamper, reparse metadata qua fault injection, publish/register song song, adapter thay thế, orphan/rollback và lỗi COMMIT PostgreSQL thực. Test filesystem phải chạy ngoài sandbox do thư mục private của pytest bị chặn; thư mục test mới nằm dưới backend/test-results, DB ngẫu nhiên riêng được dọn. Không chạy frontend/browser vì không đổi HTTP/UI; cảnh báo TestClient/httpx có sẵn còn tồn tại.
- Đã áp dụng control 001 vào DB dev local, replay bằng CLI no-op, index 0 row; đối chiếu số dòng app/retry và migration history báo giá trước/sau khớp. Không sửa backend/.env hoặc seed dữ liệu. Kho host thực chưa provisioning; index không có scope/quyền/provenance/artifact-ready và chưa có HTTP/UI. PUBLIC bị revoke không tách được dev owner/superuser; runtime DB roles, ACL, power-loss/symlink race và isolation còn phải kiểm chứng trước dùng cho code không tin cậy.
- Cập nhật README, setup, source map, API/architecture, gói lựa chọn và lộ trình. Lát cắt storage đã hoàn thành; T03–T06 toàn hệ thống chưa xong. Tiếp theo registry authority/scope/repo và snapshot refs, rồi artifact/harness/gate. Oracle/fixture, trusted R, acceptance và protocol nghiên cứu giữ trạng thái còn mở; không dùng raw blob làm bằng chứng test/approval hoặc cache entry.

## 2026-11-09 — Cụ thể hóa thiết kế local T03–T04 v0.1

- Theo yêu cầu hoàn thiện thiết kế trước code gate, soạn [gói phương án local v0.1 để xác nhận](overview.md#gói-thiết-kế-local-t03t04-để-xác-nhận). T03 có data dictionary/FK theo scope, source bundle trên runtime image tin cậy, blob store, publish/transaction/migration và retention/reset; API có encoding/digest/patch identity, binding refs, deployment/unknown status và retry semantics.
- T04 có đề xuất control authority/grants riêng, thời điểm kiểm quyền tại dispatch permit, TTL approval 30 phút/single deployment, Docker isolation/limits, reservation/fence/single-writer launcher và đối soát ACK/crash. Evaluation có event envelope và ma trận G01–G14 liên kết cùng safety property. Đây là thiết kế chờ người dùng chọn; không ghi các lựa chọn mới thành policy đã có hiệu lực hoặc xác nhận của giảng viên.
- Kiểm chứng tài liệu: đối chiếu contract/phân quyền/state transitions và nguồn chính thức PostgreSQL/Python/Docker; tính hai vectors encoder SHA-256, kiểm ổn định key order và source newline khác bytes. Rà link/anchor, ví dụ, phạm vi diff và tính nhất quán. Chỉ sửa Markdown; không chạy lại lint/test ứng dụng, DB, browser hoặc thực nghiệm vì không đổi code/configuration.
- T03–T04 chưa đánh dấu hoàn tất: cần xác nhận gói local, đăng ký image/profile/scope thực và kiểm chứng harness/sandbox/ACL/network/single-writer/recovery khi triển khai; phần cache/retrieval và protocol nghiên cứu còn mở. Không thêm SQL/schema/launcher/SDK hoặc kích hoạt artifact; oracle/one-fixture contract, trusted R và acceptance vẫn theo trạng thái trước đó.

## 2026-11-09 — Luồng validation nền và bản nháp gate T04

- Theo yêu cầu tiếp tục phần source app nền, thêm [validate_quotation](../../backend/app/quotation_demo/business/quotation_validation.py), service và POST /api/v1/quotations/{UUID}/validate; UI chi tiết có nút Kiểm tra báo giá. Người dùng chọn chỉ operator có quotation.validate; service cần cả read/validate trước đọc DB, reader vẫn chỉ đọc. Validate không nhận profile/flags/approval từ client, không ghi dữ liệu hoặc metadata retry.
- Baseline cố ý chưa có quy tắc nghiệp vụ: flags/evaluated_rules rỗng, UI ghi Chưa áp dụng quy tắc nghiệp vụ. reference_date/active_artifact null công bố rõ runtime binding chưa có; profile label không phải bằng chứng artifact. Lỗi validator trả lỗi thật, không fallback thành kết quả rỗng. Rule expiration_review vẫn dành cho nhiệm vụ sửa code sau này; chưa đóng băng baseline nghiên cứu. Các assertion không có rule mới được đánh dấu baseline_only, tách khỏi hồi quy chung để bản sửa đúng không phải xóa/sửa test kiểm tra trạng thái gốc; đã kiểm tra selection 170/172 ca hồi quy chung.
- Kiểm chứng: **172 test backend với PostgreSQL thật, không skip; 68 test frontend; Ruff lint/format, ESLint, typecheck và production build đạt**. Browser integration riêng với Edge → API → DB tạm đạt: reader bị chặn, operator validate đúng record, raw date giữ nguyên, kết quả bị xóa khi đổi record/phiên và response đến trễ không phục hồi phiên cũ; retry và responsive 390/820/1440 vẫn đạt. Đã dừng frontend/API test và dọn DB tạm; giữ DB app. Còn cảnh báo TestClient/httpx, Node module detection và pytest cache trong sandbox có sẵn; chưa kiểm chứng browser/thiết bị khác.
- Cập nhật README và tài liệu sở hữu API/quyền/source/frontend/setup/overview/lộ trình. [Bản nháp gate T04](../system/authorization.md#bản-nháp-gate-t04-để-review--2026-11-09) có chuỗi source → artifact/test → binding → explicit review → activation/reconciliation, phân biệt commit DB với side effect launcher và liệt kê lựa chọn còn mở; chưa triển khai hoặc khóa policy gate. T07 còn oracle/one-fixture contract, trusted R/artifact metadata và revision gốc; T03–T04 còn authority, storage, sandbox/target/lifecycle và atomicity. Chưa chạy Agent/thực nghiệm hoặc chốt acceptance.

## 2026-11-09 — Kiểm chứng lại T07 với PostgreSQL thật

- Sau khi người dùng mở Docker Desktop, khởi động lại container PostgreSQL CacheSec hiện có; giữ nguyên volume và dữ liệu app. Chạy toàn bộ backend với DSN test chỉ đặt trong process, không in credentials hoặc đổi file cấu hình. Test báo giá tạo/dọn database ngẫu nhiên riêng; test hạ tầng dùng bảng TEMP.
- **155 test backend đạt, không skip**, gồm 23 test PostgreSQL từng bị chặn và các ca T07 mới giữ missing/null/raw date, ngày biên/nhuận/whitespace/timestamp, chuỗi rỗng, tiền âm/zero/precision và currency ngoài danh sách. Còn cảnh báo TestClient/httpx và pytest cache không ghi được trong sandbox; không ảnh hưởng kết quả. Không đổi implementation nên không chạy lại frontend/browser.
- Đã gỡ blocker kiểm chứng DB trong lộ trình. T07 vẫn chưa hoàn tất: [bảng oracle](../evaluation/design.md#bảng-oracle-t07-để-review) và one-fixture contract cần review trước tạo manifest. Chưa thêm rule ngày, đóng băng fixture, chạy thực nghiệm hoặc chốt acceptance; container DB được giữ chạy để tiếp tục phát triển.

## 2026-11-09 — Khóa contract nền T07 và soạn bảng oracle review

- Người dùng xác nhận giữ validation nền hiện tại, không thêm giới hạn nội dung/tiền/currency; đồng thời xác nhận parse của rule mới chỉ nhận YYYY-MM-DD có thật, không trim/ép kiểu/nhận timestamp. Missing/null/rỗng/sai kiểu/ngày sai hoặc trước R = 2026-11-07 cần cờ sau khi có rule. Đây là quyết định đặc tả của người dùng, chưa phải duyệt oracle hoặc nghiệm thu giảng viên.
- Contract nền đã có implementation nên không thêm validator/layer hoặc đổi schema/API/UI. Bổ sung 29 ca HTTP từ chối thiếu trường/sai kiểu/sai cú pháp tiền trước storage, hồi quy frontend về chuỗi/precision/currency và kiểm tra response tiền sai. Mở rộng test HTTP → PostgreSQL giữ missing/null/raw date, ngày biên/nhuận/whitespace/timestamp; thêm ca giữ chuỗi rỗng, tiền âm/zero/dài và currency ngoài danh sách. Dữ liệu test kỹ thuật không phải fixture nghiên cứu.
- Kiểm chứng lượt này: **132 test backend đạt, 23 test PostgreSQL skip** khi không cấu hình DSN test; Ruff lint/format đạt. Đã thử DSN local riêng trong process test nhưng kết nối timeout, Docker Linux Engine chưa chạy; dừng lượt lỗi kết nối, chưa xác nhận các ca tích hợp mới. **66 test frontend, ESLint và typecheck đạt**; test Studio cần chạy ngoài sandbox do spawn Node con bị EPERM, lượt ngoài sandbox đạt. Cảnh báo Node module detection và TestClient/httpx có sẵn còn tồn tại; không chạy build/browser vì không đổi implementation ứng dụng.
- Cập nhật overview, API, evaluation và lộ trình; sửa vài mô tả hiện trạng báo giá cũ trong overview. [Bảng oracle T07](../evaluation/design.md#bảng-oracle-t07-để-review) có 16 nhóm ca để review, chưa tạo parser/oracle thực thi hoặc manifest đóng băng. T07 còn review nhãn/one-fixture contract và kiểm chứng tích hợp mới; T03–T04 còn thiết kế control/artifact/executor/gate. Không cài rule mới, kích hoạt artifact, chạy thực nghiệm hoặc chốt acceptance.

## 2026-11-09 — Đặt lại tên và tổ chức backend theo công việc

- Theo phương án người dùng duyệt, báo giá chia api/business/auth/database; models/service/quyền/interface repository thuộc business, token fixture thuộc auth, SQL/transaction/migration thuộc database. Đổi tên rõ mục đích như quotation_routes, quotation_responses, postgres_connection; gom interface và implementation cấp service vào quotation_service_factory. Không thêm tầng hoặc dependency. [Bản đồ source](../system/code-organization.md#backend) sở hữu cây file và luồng đọc code.
- Điểm khởi động mới: control = app.control.control_api:app; báo giá = app.quotation_demo.quotation_api:create_app --factory; migration = python -m app.quotation_demo.migrate_quotations. Đã cập nhật import, tests và lệnh/link docs; không giữ module alias cũ. Business tiếp tục nhận dependency qua Protocol nhỏ, không import API/DB/auth/control. Bổ sung luật đặt tên theo đối tượng/công việc trong AGENTS.
- Kiểm chứng: **125 test backend và browser integration riêng đạt**, Ruff lint/format đạt. Hai OpenAPI đối chiếu bằng bản trước refactor khớp hoàn toàn; SQL giữ nguyên từng byte/checksum, migration local replay no-op, số dòng app/retry và history khớp trước/sau. Uvicorn khởi động bằng cả hai entrypoint mới; health/ready và đọc báo giá có token trả 200, thiếu token 401, CORS/request ID giữ nguyên. Edge → API mới → DB test riêng kiểm quyền, dữ liệu, retry/response đến trễ và responsive đạt; đã dọn DB/API test, bật lại API app local cổng 8001 bằng module mới.
- Đây là refactor tên/vị trí và lắp ghép, không thêm nghiệp vụ hoặc rule expiration_review, không sửa dữ liệu app/fixture nghiên cứu. Không đổi code/frontend/Prisma, không chạy lại bộ test frontend vì HTTP contract giữ nguyên; còn cảnh báo TestClient/httpx có sẵn. T07 validation nền/fixture-oracle và thiết kế control/gate vẫn là bước tiếp theo theo các điều kiện đã ghi.

## 2026-11-09 — Thêm Prisma Studio cho database local

- Theo yêu cầu, cài Prisma CLI **7.10.1** dạng devDependency trong npm workspace frontend, ghim package-lock và thêm npm run db:studio (cổng 5555, browser none). Chọn bản stable vì tag latest lúc cài là 8.0.0-rc.33; không đổi phiên bản dependency ứng dụng đã có. Studio dùng trực tiếp PostgreSQL hiện tại; SQL migration/nghiệp vụ vẫn thuộc backend Python.
- prisma.config.ts chỉ lấy QUOTATION_DATABASE_URL từ môi trường hoặc backend/.env, không fallback DSN control, không đưa mật khẩu vào argv hoặc export token fixture; lỗi cấu hình được rút gọn và tắt checkpoint telemetry cho process. Không tạo Prisma schema/client/migration hoặc thêm dữ liệu. Studio có quyền database từ DSN, thao tác trực tiếp không thuộc Bearer/idempotency/approval gate của API; chỉ dùng cho dev.
- Kiểm chứng: npm ls xác nhận phiên bản, ESLint/typecheck và **64 test frontend đạt**, gồm kiểm tra chọn đúng DSN, config độc lập cwd, thiếu/sai URI và không lộ secrets/token. Studio HTTP/SQL proxy trả 200, đọc được ba bảng quotation_demo; Edge hiển thị schema/bảng, không lỗi runtime. Xác nhận socket chỉ bind 127.0.0.1:5555; đã để Studio chạy để dùng thử. Mặc định schema public có thể trống; setup có link mở thẳng quotations.
- Cập nhật README, setup và bản đồ source. Đây là công cụ phát triển, không phải kết quả thực nghiệm hoặc thay đổi quyền/schema backend. Không chạy lại backend/full browser app vì không đổi code ứng dụng; cảnh báo Node module detection có sẵn còn tồn tại. Các phần nghiên cứu/Agent/cache/gate và câu hỏi mở giữ trạng thái trước đó.

## 2026-11-09 — Nối giao diện báo giá với API/PostgreSQL

- Theo yêu cầu làm và nối đồng thời, thêm /quotations và liên kết Báo giá ở sidebar/toolbar Workspace. Form tạo, danh sách/phân trang và chi tiết dùng HTTP/PostgreSQL thật; IDE giữ hai vùng code/chat và các thao tác Agent/review/test/deploy mẫu. Model, HTTP adapter, hook phiên và từng component tách theo ownership tại features/quotations; không thêm dependency.
- Token fixture nhập qua ô password, chỉ giữ trong bộ nhớ route; ngắt kết nối/rời trang hoặc 401 xóa phiên/dữ liệu và bỏ response đến trễ. Backend giữ quyền reader/operator, kiểm đầu thao tác như đã chọn. Factory ASGI bọc CORS allowlist cho GET/POST và header cần thiết, kể cả response lỗi; CORS không cấp quyền. Cấu hình frontend chỉ có public API URL, không chứa token.
- Form giữ precision/lexeme tiền và ngày missing/null/chuỗi/JSON thô, chưa validate ngày hoặc thêm expiration_review. Lần gửi chưa rõ kết quả giữ nguyên body/key và khóa sửa để retry; refresh lỗi sau commit không biến báo giá đã lưu thành yêu cầu gửi lại. Rời route/reload mất key đang chờ; recovery bền vững chưa triển khai. Chi tiết nằm trên danh sách, focus sau chọn/lưu; danh sách cuộn riêng và mobile xếp dọc.
- Kiểm chứng: **125 test backend và 63 test frontend đạt**, Ruff/ESLint/typecheck và production build đạt. Browser integration riêng đạt với Edge → HTTP/CORS → PostgreSQL: 53 record seed và sáu lần tạo hợp lệ, retry sau mất response vẫn chỉ có sáu metadata tạo; kiểm quyền, missing/null/raw date, precision, nhập HTML an toàn, lỗi tải/response đến trễ, ngắt/rời phiên và ba kích thước. Full browser smoke các màn cũ cũng đạt (Workspace, Thiết lập, Chat, Số liệu, Tài liệu, UI kit, keyboard/responsive), không lỗi runtime/React. Runner dùng token/DB test ngẫu nhiên riêng, dừng API tạm và dọn đúng DB đã tạo. Lỗi transport là fault injection sau fetch thật; không phải benchmark/fixture nghiên cứu. Đã sửa lỗi receiver khi gọi native fetch và thêm regression test.
- Đã chạy frontend dev 127.0.0.1:3000 và API app 127.0.0.1:8001 để dùng thử; đọc bằng token local/CORS đúng origin trả 200, DB app vẫn 0 báo giá/0 metadata retry, migrate no-op. Next dev tự sinh frontend/AGENTS.md hướng dẫn đọc tài liệu framework tại node_modules; không đổi AGENTS gốc. Còn cảnh báo Node module detection và TestClient/httpx từ dependencies.
- Cập nhật README, setup, frontend design, API, authorization, architecture, bản đồ source và lộ trình. T15 mới xong phần UI app, các gói toàn hệ thống chưa hoàn thành; tiếp theo validation nền/fixture-oracle T07 khi chốt đầu vào còn mở và thiết kế control/artifact/executor/gate T03–T04. Agent/cache/gate/audit và ngưỡng nghiệm thu nghiên cứu chưa được triển khai/chốt; không triển khai trước rule mới vào baseline.

## 2026-11-07 — API báo giá độc lập, quyền fixture và idempotency

- Đã triển khai POST tạo, GET danh sách/chi tiết tại /api/v1/quotations qua factory app.quotation_demo.main:create_app, độc lập control/Agent/cache. QuotationService nhận port quyền và repository/session qua constructor; HTTP, authority fixture và PostgreSQL là adapter riêng. Bổ sung luật SOLID và [bản đồ source](../system/code-organization.md#backend); không thêm dependency hoặc sửa frontend.
- Người dùng chốt reader/operator, Bearer token ngẫu nhiên cấu hình riêng, không mặc định identity; quyền kiểm ở đầu mỗi thao tác/replay. Thu hồi chặn thao tác tiếp theo, không hủy thao tác đã bắt đầu hoặc thu lại nội dung đã đọc. Hai principal đọc cùng dataset app, chưa có tenant isolation hoặc grants Reviewer/control. Registry/revoke trong một process, đổi token cấu hình cần restart; đây là identity fixture PoC.
- Chốt cap kỹ thuật 64 KiB body thực, 100 mục/trang, key ASCII 1–128 ký tự. Migration 002_creation_requests.sql lưu retry metadata theo principal/scope/key, cùng transaction với báo giá; retry song song không tạo trùng, khác payload trả 409. Giữ sáu cột nghiệp vụ, missing/null/raw date và precision tiền; chưa có expiration_review. Sửa adapter PostgreSQL luôn đóng connection khi commit lỗi, không trả thành công trước commit.
- Kiểm chứng: **119 test backend đạt, không skip**, gồm PostgreSQL thật, HTTP → DB, thu hồi giữa thao tác, replay/giả header, cap body stream, lỗi commit/rollback và retry song song; Ruff lint/format đạt. HTTP network local qua Uvicorn: thiếu/sai token 401, reader/operator đọc 200, reader tạo 403, OpenAPI 200. Áp dụng migration 002 local/replay no-op; quotations và creation_requests đều 0 dòng, không seed/reset dữ liệu app. Token local được sinh trong file .env bị Git bỏ qua; server smoke đã dừng. Còn cảnh báo deprecation TestClient/httpx từ dependency; chưa chạy frontend hoặc thực nghiệm.
- Đồng bộ README, overview, API, authorization, architecture, setup và lộ trình. Lát cắt API/quyền app hoàn thành; T03–T07 toàn hệ thống vẫn còn việc. Tiếp theo hoàn thiện validation nền/fixture-oracle T07 khi chốt đầu vào còn mở, đồng thời thiết kế control/artifact/executor/gate T03–T04. Cache, Agent, approval/deployment gate và audit chưa triển khai; acceptance nghiên cứu vẫn chờ cô, không lấy số test kỹ thuật làm threshold.

## 2026-11-07 — Chuẩn hóa PascalCase/camelCase cho file React/TypeScript

- Theo yêu cầu người dùng, đổi file component .tsx sang PascalCase (ChartFrame.tsx, AppShell.tsx, Select.tsx), hook/helper/model/data .ts sang camelCase (useField.ts, chartFormat.ts, chatState.ts). Giữ tên framework/entry page.tsx, layout.tsx, index.ts; thư mục feature, Python và JS DOM/bundle giữ quy ước riêng. Tổng cộng 102 file TypeScript đổi tên; cập nhật import, snippets, nhãn source trong UI kit, test và link docs cùng lượt.
- Sửa luật AGENTS và bản đồ source, bật forceConsistentCasingInFileNames. Hai đổi tên chỉ khác hoa/thường Button/Icon được ghi vào Git index bằng rename; giữ nguyên blob index trước đó và các thay đổi nội dung chưa stage. Không commit hoặc stage các nội dung khác.
- Kiểm chứng: frontend lint/typecheck, 57 test logic và production build đạt. Edge full smoke đạt Workspace, Thiết lập, Chat, Số liệu, Tài liệu, UI kit, keyboard và responsive; không lỗi runtime/React. Kiểm tra exact casing cho 321 import nội bộ, 21 nhãn source và 20 snippet qua helper; snippet Toast dùng đường dẫn mới. Rà 137 link/anchor tài liệu; so hash xác nhận backend và template JS/CSS giữ nguyên nội dung. Các quyết định nghiên cứu và trạng thái nghiệp vụ không thay đổi.

## 2026-11-07 — Refactor tổ chức source và cập nhật quy tắc

- Bổ sung AGENTS về ownership theo feature/domain, đặt tên theo trách nhiệm, mỗi component công khai một file, composition/class theo nhu cầu và phân biệt source/bundle. [Bản đồ source](../system/code-organization.md) ghi cấu trúc và file cần mở khi sửa từng phần; không coi OOP là yêu cầu đổi React sang class hoặc thêm tầng rỗng.
- Frontend tách UI thành forms/charts/navigation/feedback/data/diagrams; catalog definition/snippet và preview riêng theo từng template. Workspace cấu hình cũ đổi thành experiment-config, tách profile/comparison/plan/setup models và provider; Workspace IDE giữ route/feature riêng. Snippet sao chép dùng import mới; phần Mã tích hợp hiển thị source thực tế.
- Backend main.py còn composition ASGI; control sở hữu settings/health router, shared/postgres.py chứa PostgresDatabase, app báo giá có domain/quotation và persistence/PostgresQuotationRepository/migrations/SQL riêng. Test đi theo ownership; giữ CLI/ASGI, env, API và định danh/checksum SQL. Migration replay trên DB đã áp dụng trả applied = []. Không thêm nghiệp vụ, thay fixture hoặc chạy thực nghiệm.
- Template JS tách 21 component + helper thành 26 source modules đọc được; build/check sinh bundle NoiUI v2.0.0 giữ cách nhúng defer. Catalog data/page, demo shell và prototype legacy tách riêng; sửa lỗi cú pháp $$let có sẵn ở source demo, bỏ workaround vá response browser. Không thêm dependency ứng dụng; Prettier chỉ dùng như công cụ tạm để format.
- Kiểm chứng: frontend lint/typecheck, 57 test logic và production build đạt; backend Ruff/format và 58 test (gồm PostgreSQL thật) đạt. Edge production full smoke đạt Workspace, thiết lập, Chat/Số liệu/Tài liệu/UI kit, keyboard và responsive; --reference thêm kiểm tra tương tác/lifecycle của 21 template JS và ảnh tham chiếu. Đã chụp UI catalog hiện tại desktop/mobile, xác nhận nhãn source; không lỗi runtime/React. Cảnh báo Node module detection và TestClient/httpx có sẵn còn tồn tại. Quyền/API app báo giá và các điều kiện nghiên cứu còn mở như trước.

## 2026-11-07 — Hoàn thành lát cắt schema/migration/storage báo giá

- Thêm package app.quotation_demo độc lập HTTP/control/cache: domain models, PostgreSQL store create/get/list và config QUOTATION_ riêng, không fallback sang DSN control. Schema quotation_demo.quotations có đúng sáu cột; tiền giữ nguyên chuỗi thập phân, expires_on kiểu JSON giữ SQL NULL (missing) khác JSON null và giá trị ngày sai. Chưa có rule expiration_review, API/UI hoặc runtime validation.
- Migration CLI có history/checksum chuẩn hóa newline, transaction/advisory lock, từ chối history lạ/đã sửa; batch lỗi rollback. Đã áp dụng 001_create_quotations.sql vào PostgreSQL local, chạy lại no-op. Bảng app local còn trống; không seed/reset dữ liệu nghiên cứu hoặc tạo schema control/cache/artifact.
- Kiểm chứng: **58 test backend đạt, không skip**, Ruff lint/format đạt; kiểm tra commit/rollback qua connection mới, SQL parameters, precision, missing/null/raw date, pagination, migration replay/checksum/failed-batch/concurrency và import độc lập. Test DB báo giá cấp DB ngẫu nhiên riêng, dọn đúng DB đã tạo; không thay dữ liệu app. Cảnh báo deprecation TestClient/httpx từ dependency còn tồn tại. Chưa chạy frontend hoặc thực nghiệm.
- Cập nhật schema/transaction/lifecycle tại architecture, types tại API, overview, setup, README và lộ trình. Lát cắt đã hoàn thành; T03/T05/T07 toàn hệ thống vẫn còn control/artifact/identity/API/fixture. Bước tiếp theo là quyền/scope tối thiểu và API báo giá độc lập trước khi nối UI; acceptance nghiên cứu vẫn chờ cô.

## 2026-11-07 — Kiểm chứng PostgreSQL thật sau khi bật Docker

- Khởi động Compose local: PostgreSQL **17.11**, extension pgvector **0.8.7**, container healthy. Tạo infra/.env và backend/.env khi chưa có, dùng mật khẩu local ngẫu nhiên; hai file được Git bỏ qua, không ghi credentials vào tài liệu hoặc output. Giữ container/volume chạy để tiếp tục phát triển.
- Chạy toàn bộ backend với CACHESEC_TEST_DATABASE_URL: **25 test đạt, không skip**, gồm probe và đọc/ghi parameterized SQL trên bảng TEMP chỉ tồn tại trong session. Kiểm tra qua TestClient với DB thật: /health và /ready trả 200. Smoke riêng xác nhận statement timeout hủy pg_sleep và connection được đóng sau lỗi. Đây là kiểm chứng kỹ thuật, không phải chạy thực nghiệm hoặc benchmark.
- Cập nhật README/lộ trình; không đổi source ứng dụng hoặc schema nghiệp vụ. T05 vẫn còn migration/persistence và điều kiện thiết kế T03–T04; acceptance nghiên cứu vẫn chờ xác nhận. Cảnh báo deprecation TestClient/httpx từ dependency còn tồn tại.

## 2026-11-07 — Bắt đầu code nền PostgreSQL/readiness (một phần T05)

- Theo yêu cầu chuyển sang code, thêm [adapter PostgreSQL](../../backend/app/shared/postgres_connection.py) dùng Psycopg, kết nối theo thao tác với commit/rollback/close, secret DSN và connect/statement timeout. Không có schema/migration, retry ngầm hoặc tự tạo extension. Adapter độc lập HTTP, workflow và nghiệp vụ báo giá; không chốt thay quyền/integrity/executor/gate còn mở.
- Thêm GET /ready: query DB thành công mới trả 200; chưa cấu hình hoặc DB lỗi trả 503 với mã trạng thái ngắn, không lộ DSN/exception. GET /health vẫn không gọi DB. Readiness hiện chỉ kiểm tra PostgreSQL, chưa chứng minh schema/model/quyền/workflow sẵn sàng; vector chưa là dependency bắt buộc.
- Kiểm chứng: Ruff lint/format, pip check và 23 test backend đạt; hai test PostgreSQL thật skip do chưa đặt CACHESEC_TEST_DATABASE_URL và Docker Linux Engine chưa chạy. Có test lỗi qua driver thật với DSN sai, nhưng không tính là DB integration đã đạt. Còn cảnh báo deprecation TestClient/httpx từ dependency, không đổi thêm dependency ngoài nhu cầu driver. Chưa chạy frontend hoặc thực nghiệm.
- Cập nhật README, setup, API/architecture và lộ trình. T05 vẫn chưa hoàn thành; tiếp theo chuẩn bị schema/migration từ T03 và control T04, kiểm chứng kết nối/transaction trên DB thật khi có môi trường. Acceptance nghiên cứu vẫn chờ cô; app báo giá, Agent, cache và gate chưa được triển khai.

## 2026-11-07 — Hoàn thiện đặc tả kỹ thuật T02 v0.2

- Tách [contract backend và cache](../system/api.md) thành nơi sở hữu types, request/response và ví dụ, ContextRequest trước local lookup, nhóm route app/control, capability matrix, state transitions, retry/idempotency và lỗi. Architecture giữ module/runtime và phân bổ source, liên kết thay vì chép bảng API cũ. Các GET/status/events/context và replay đều phải kiểm tra quyền; quyết định cũ không làm sống lại approval đã mất hiệu lực.
- T02 hoàn thành **đầu ra thiết kế v0.2**, chưa triển khai hoặc đóng các quyết định T04. Giữ sáu trường báo giá; expires_on qua HTTP/storage ở dạng missing/null/raw để không cài trước rule vào baseline. Host IDE ngoài có thể dùng contract cache qua adapter mà không dựng toàn bộ app báo giá/WorkflowRun API. T01 vẫn chờ fixture/oracle/baseline/acceptance; bước tiếp theo T03 thiết kế ERD/storage/lifecycle, rồi đối chiếu control T04 trước code.
- Kiểm chứng tài liệu: nội dung, liên kết/anchor, JSON examples, ID/checklist và diff/whitespace; so sánh hash xác nhận chỉ tài liệu thuộc tác vụ đổi. Chưa chạy lint/typecheck/backend/browser/DB hoặc thực nghiệm vì không đổi implementation/configuration; chưa có API, SDK, migration hay fixture mới.

## 2026-11-07 — Bản nháp T02: module backend và API

- Từ các đầu vào kỹ thuật T01 đã được người dùng chọn, soạn [bản nháp T02](../system/architecture.md#bản-nháp-t02-module-và-contract): ranh giới module/runtime, nhóm API app/control, contract cache độc lập host, trạng thái, retry/idempotency, lỗi và trace. Bám code hiện tại chỉ có health/CORS; các route trong thiết kế chưa tồn tại.
- T02 mới ở mức nháp, chưa hoàn thành hoặc khóa request/response types, permissions/transitions, schema DB hay cơ chế sandbox/integrity. T01 vẫn chờ phần fixture/oracle/protocol và ngưỡng cô quy định; không đưa 100% vào cấu hình mặc định. Có thể tiếp tục thiết kế phần không phụ thuộc các giá trị này, chưa triển khai phần bị chặn.
- Chỉ sửa tài liệu; rà nội dung/link/anchor/diff/whitespace và phạm vi thay đổi, giữ các chỉnh sửa có sẵn. Không scaffold, thêm dependency, tạo bảng/API, chạy test ứng dụng hoặc thực nghiệm.

## 2026-11-07 — T01 đang thực hiện: Context Cache trong trình duyệt

- Bắt đầu T01, chuẩn bị [hồ sơ đầu vào](overview.md#hồ-sơ-đầu-vào-t01--đang-thực-hiện) và khung protocol review trong evaluation. Người dùng chốt Context Cache/browser trước, adapter IDE sau; ngày YYYY-MM-DD có thật và không trước mốc fixture 2026-11-07 (bằng mốc hợp lệ); bộ sáu trường báo giá; identity fixture backend quản lý và cho phép Developer tự duyệt nếu có quyền Reviewer hiện tại, quyết định tường minh đúng artifact. Đây là lựa chọn của người dùng, không phải xác nhận phương pháp từ giảng viên.
- Đồng bộ README, overview, architecture, cache và kế hoạch theo lựa chọn mới, thay đề xuất Answer Cache đầu tiên. Browser tìm/lưu candidate; backend phải xác minh payload/quyền/nguồn trước khi Agent dùng. Context Hit vẫn cần LLM xử lý; chưa có bằng chứng giảm calls/tokens hoặc thời gian.
- T01 chưa hoàn thành: tên/kiểu/parse/validation nền và mapping quyền chi tiết sẽ đặc tả ở T02–T04; fixture/oracle, baseline/số lặp chưa khóa. Người dùng chưa chọn acceptance, chờ cô quy định, không dùng đề xuất 100% trước đây như mặc định. Đã có ma trận ngày trước/bằng/sau mốc để review. Không tạo code, bảng hoặc fixture; chỉ kiểm tra tài liệu/link/anchor/diff và phạm vi thay đổi, chưa chạy test ứng dụng hay thực nghiệm.

## 2026-11-07 — Danh sách công việc backend, dữ liệu và PoC tuần tự

- Cập nhật [kế hoạch PoC](implementation-plan.md) thành T01–T17, mỗi gói có phụ thuộc, đầu ra và điều kiện nghiệm thu: thiết kế T01–T04; backend/database/quyền/trace/app nền T05–T07; retrieval/model/cache T08–T11; executor/gate/Agent T12–T14; UI/runner T15–T16; so sánh chính T17. Các gói đều chưa hoàn thành; thiết kế chi tiết vẫn cần thực hiện, không coi danh sách là schema/API đã chốt.
- Gate/trace contract được chuẩn bị trước code, gate phải thực thi trước activation rule mới; bản app gốc vẫn chưa có rule mới. Phép thử riêng cache, adapter IDE/MCP và các biến thể nằm ở X01–X03, tách khỏi phạm vi chính. Giữ một repo/fixture/gate/acceptance và ba ranh giới đã thống nhất; bước tiếp theo là T01 rồi thiết kế T02–T04.
- Chỉ sửa kế hoạch, mục lục và trạng thái; giữ các thay đổi có sẵn. Kiểm tra nội dung, liên kết/anchor, thứ tự phụ thuộc, diff/whitespace và phạm vi file; không chạy test ứng dụng, database hoặc thực nghiệm vì chưa đổi code/cấu hình.

## 2026-11-07 — Quy tắc tích hợp cache vào IDE/Agent

- Bổ sung theo yêu cầu người dùng: contract cache chung có phiên bản, được tài liệu hóa, có thể cung cấp bằng SDK/API và adapter theo host; web Workspace là một nơi tích hợp, không phải điều kiện sử dụng. Chỉ công bố tương thích với tổ hợp IDE/Agent/adapter đã kiểm chứng. [Kiến trúc](../system/architecture.md#tích-hợp-cachesec-vào-ide-và-agent) sở hữu chi tiết; quyền/nguồn vẫn xác minh tại thành phần tin cậy, gate độc lập.
- Cập nhật AGENTS, NFR-06 và lộ trình. Hỗ trợ nhiều IDE là hướng mở rộng, không tự thêm extension/SDK, fixture hoặc thay phạm vi PoC. Chưa có SDK/API/extension; chưa chọn adapter, packaging/transport hoặc vị trí local cụ thể.
- Chỉ sửa tài liệu; kiểm tra nội dung, liên kết/anchor và diff/whitespace, không chạy test ứng dụng. Bước tiếp theo vẫn là khóa contract cần thiết trước lập trình.

## 2026-11-07 — Quy tắc tách ứng dụng, Agent/IDE và lõi cache

- Đã thống nhất theo yêu cầu người dùng: tách cả source ứng dụng báo giá, host Agent/IDE và lõi cache trong cùng repository; ứng dụng chạy độc lập, cache có contract/adapter để tích hợp với host/repo khác. [Kiến trúc](../system/architecture.md#quy-tắc-độc-lập-giữa-ứng-dụng-agentide-và-cache) sở hữu hướng phụ thuộc, ranh giới runtime/dữ liệu và phạm vi sửa source; không bắt buộc database/repository riêng.
- Bổ sung quy tắc vào [AGENTS.md](../../AGENTS.md), NFR-06, thiết kế cache, lộ trình và mục lục docs. Đây là quyết định thiết kế của người dùng, chưa phải implementation hoặc yêu cầu mới được giảng viên xác nhận; chưa tạo module, adapter, entrypoint hay API. Vị trí local, loại cache, storage, packaging/API và sandbox/deployment cụ thể vẫn mở; gate tiếp tục độc lập và gắn đúng artifact.
- Chỉ sửa tài liệu/hướng dẫn. Đã rà nội dung/diff, liên kết và anchor nội bộ, whitespace; không chạy test ứng dụng. Bước tiếp theo khi lập trình: chốt contract cần thiết và kiểm tra hướng import/khả năng chạy độc lập theo kế hoạch PoC.

## 2026-11-07 — Workspace theo bố cục IDE

- Theo yêu cầu tiếp theo, đổi bố cục một cột thành hai vùng code bên trái/chat Agent bên phải, cuộn riêng theo viewport; màn nhỏ xếp dọc. Bỏ card nhiệm vụ, progress và banner; giữ nhãn Mô phỏng nhỏ, file/revision, Diff/Bản gốc và ô nhập phía dưới chat.
- Kiểm thử/Phê duyệt mở bằng hai nút toolbar; nhật ký thu gọn trong hộp thoại Phê duyệt. Escape/nút đóng trả focus về nút mở. Ghi chú và thử revision mẫu khác nằm trong Mã mẫu · Chỉ đọc. Cập nhật phản hồi mẫu để không hướng dẫn tới thẻ/tab đã bỏ, README, thiết kế frontend và setup. Chưa kết nối Agent, đọc/sửa code thật hoặc triển khai backend; nút triển khai vẫn khóa.
- Kiểm chứng: lint, typecheck, 57 test logic và production build đạt; Edge production smoke riêng Workspace đạt 16 bố cục, hai vùng desktop/xếp dọc mobile, hộp thoại, focus/keyboard, gửi rỗng/Enter, nhập an toàn, reset và vô hiệu phê duyệt theo revision. Không lỗi runtime/React; đã xem ảnh desktop/mobile và phê duyệt, rà diff/whitespace. Browser chạy ngoài sandbox bằng profile riêng; chưa chạy lại full smoke các màn cũ hoặc kiểm chứng browser khác. Contract nghiệp vụ/fixture/gate cho tích hợp thật vẫn cần chốt.

## 2026-11-07 — Tinh gọn Developer Workspace

- Bỏ metadata repo/branch, breadcrumb, tiêu đề trợ lý, avatar/nhãn vai trò, hội thoại có sẵn, liên kết diff lặp, thẻ kịch bản cache, câu hỏi gợi ý và hướng dẫn phím gửi. Bố cục một cột; giữ ô nhập, hội thoại sau khi gửi và bốn tab review. Hội thoại trống không chiếm chiều cao; Bắt đầu lại xóa hội thoại.
- Cập nhật README, thiết kế frontend, hướng dẫn chạy và browser check theo giao diện mới. Giữ các chỉnh sửa tinh gọn có sẵn ở panel; nhãn mô phỏng, điều kiện duyệt theo revision và nút triển khai khóa vẫn rõ. Chưa có Agent/cache/gate backend thật; contract nghiệp vụ/fixture/gate còn mở.
- Kiểm chứng: lint, typecheck, 57 test logic, production build và Edge smoke riêng Workspace đạt (16 bố cục, nhập an toàn, Enter gửi, reset, keyboard, test/approval mẫu và invalidation theo revision); không lỗi runtime/React. Đã xem ảnh desktop/mobile, rà diff/whitespace. Edge không khởi động trong sandbox; lượt kiểm tra ngoài sandbox bằng profile riêng đạt. Chưa chạy lại full smoke các màn cũ hoặc kiểm chứng browser khác.

## 2026-11-02 — Quy tắc giao diện ít chữ

- Theo yêu cầu người dùng, bổ sung quy tắc tối giản chữ vào AGENTS.md: chỉ giữ nội dung cần cho thao tác, bỏ giải thích thừa/lặp, mở chi tiết khi cần. Chỉ cập nhật quy tắc, chưa rút gọn giao diện hiện tại; kiểm tra nội dung và diff, không chạy test ứng dụng.

## 2026-11-02 — Developer Workspace xem trước

- Theo yêu cầu xem web dựa trên phần đã làm, thêm `/workspace` và mục Workspace đầu sidebar. Tái sử dụng app shell, màu sắc và component hiện có; giữ Chat/Thiết lập/Số liệu/Tài liệu.
- UI gồm nhiệm vụ validation ngày hết hạn, hội thoại mẫu, ba kịch bản cache, diff/bản gốc, ca kiểm thử mẫu, phê duyệt theo revision và nhật ký thao tác. Đổi revision xóa quyết định/kết quả mẫu cũ; vai trò chỉ mô phỏng, nút triển khai luôn khóa. Giao diện responsive và điều hướng tab bằng bàn phím.
- Chưa có repository reader, Agent, cache verification, test executor, identity hoặc approval/deployment backend. Dữ liệu và kết quả hiển thị là minh họa, không phải fixture đóng băng hay bằng chứng thực nghiệm; ngày hợp lệ và acceptance threshold vẫn mở. Rời Workspace hoặc reload reset phiên mẫu.
- Kiểm chứng: lint, typecheck, 57 test logic và production build đạt; Edge kiểm tra riêng Workspace đạt 16 bố cục (bốn tab × bốn kích thước). Full smoke trên production đạt cả Workspace, các luồng cũ, 72 bố cục và 27 bố cục dữ liệu mẫu; không lỗi runtime/React. Đã xem ảnh desktop/mobile, kiểm tra 82 liên kết nội bộ không thiếu đích và rà diff/whitespace. Browser chạy ngoài sandbox bằng profile riêng. Chưa kiểm chứng các trình duyệt khác hoặc tích hợp backend.
- Cập nhật README, hướng dẫn chạy, thiết kế frontend, kiến trúc As-Is và lộ trình. Bước tiếp theo là nhận phản hồi bố cục; tích hợp thật vẫn cần khóa contract nghiệp vụ/fixture/gate theo kế hoạch PoC.

## 2026-11-02 — Cập nhật bối cảnh AI-assisted software development (chỉ tài liệu)

- Theo yêu cầu mới, giữ Secure Local Semantic Cache làm trọng tâm và dùng đúng một thay đổi validation ngày hết hạn báo giá để kiểm chứng. Ghi riêng yêu cầu giảng viên, hiện trạng có bằng chứng, giải pháp đề xuất và câu hỏi cần xác nhận; bỏ ưu tiên chatbot/upload nội bộ khỏi lộ trình hiện hành.
- Đã khảo sát README/AGENTS/Copilot, toàn bộ docs chủ đề, cấu trúc frontend/backend/research, model/providers, demo reply, metrics fixture, test/scripts, package/config và Compose/init SQL. Không tìm thấy research notes/paper summaries, source app báo giá hoặc implementation cache/Agent/gate. Không có bằng chứng các phần này đang được triển khai trong working tree; thay đổi code có sẵn chủ yếu ở UI Thiết lập và test đi kèm.
- Đã cập nhật tài liệu yêu cầu, As-Is/Target, Answer/Context Cache, verification/retrieval, exact-change approval/deployment/audit, hai lớp thí nghiệm, định nghĩa chỉ số/nguồn đo và kế hoạch mười bước. Chỉ thêm một tài liệu kế hoạch; giữ chi tiết UI Thiết lập mới, lệnh chạy và lịch sử cũ. Định nghĩa ngày, threshold, identity/gate và protocol còn mở.
- Đợt này chỉ sửa tài liệu và hướng dẫn agent; không sửa source ứng dụng, tests, dependencies, package/path hoặc hạ tầng, không chạy deploy/commit/push. Kết quả test/build/browser của các mốc cũ là bằng chứng lịch sử, không được nhận là đã chạy lại trong đợt này.
- Kiểm chứng tài liệu: rà diff; 84 liên kết nội bộ và 11 anchor trong 13 file Markdown hợp lệ; code fences/encoding/whitespace và kiểm tra mẫu secret phổ biến không có phát hiện; git diff --check đạt. Đối chiếu SHA-256 với đầu tác vụ xác nhận file ngoài tài liệu không đổi, lịch sử trạng thái 2026-10 giữ nguyên. Không chạy lại lint/typecheck/test/build/browser/DB vì chỉ sửa tài liệu; bốn liên kết web tham khảo cũ chưa kiểm tra trực tuyến.

### Hiện trạng theo nhóm chức năng

| Nhóm | Phân loại được xác nhận qua code |
| --- | --- |
| Frontend và state phiên | UI/validation thực: bốn khu, lịch sử/nháp, snapshot/JSON cấu hình, chọn/thả/phân loại tệp; reload mất phiên |
| Chat, cache status và performance dashboard | Mô phỏng/fixture UI: demo reply và 24 query giả; không LLM/cache/telemetry thật |
| FastAPI và hạ tầng | Health/CORS có code + test; Compose/pgvector có cấu hình, chưa adapter/schema và chưa kiểm chứng runtime DB trong đợt này |
| Local cache, embedding/similarity/threshold và lifecycle | Chỉ thiết kế/điều khiển nháp; chưa IndexedDB/Dexie, matching, verification, admission/TTL/eviction/invalidation thực thi |
| RBAC/ABAC, authorized RAG, LLM và metadata/provenance/version | Chỉ thiết kế; UI lựa chọn policy không cấp quyền, tệp chưa được ingest; chưa provider/authorization thực |
| Báo giá, Agent, change review/test executor | Mục tiêu mới; chưa app mẫu/fixture, repository reader/Agent integration hoặc patch pipeline |
| Approval gate, deployment control, audit/runner | Mục tiêu mới; chưa enforcement, artifact binding, execution trace hoặc kết quả năm chiều đo |

## 2026-10-29 — Thiết lập chín nhóm thông số thực nghiệm

- Trang `/setup` theo bố cục Thông số / Chức năng: Experiment Mode, Dataset, Embedding/Threshold/Eviction/Access Control Benchmark, Local Training, Request Logging và Export Results. Chọn nhiều mode/model/ngưỡng/chính sách, giữ TTL/dung lượng/số lặp/cold-warm/seed; mobile xếp dọc. Đây là cấu hình nháp; chọn quyền không cấp quyền, training/FL/logging chưa thực thi, xuất kết quả đo khóa khi chưa có run.
- Lưu snapshot có phiên bản trong phiên, tính ma trận/số lượt dự kiến (No Cache không nhân threshold/eviction), xuất cấu hình JSON với results null. Validation chặn tập rỗng/trùng/ngoài giới hạn, điều hướng giữ bản đã lưu, reload xóa phiên. Cập nhật README, thiết kế frontend/đánh giá và hướng dẫn chạy.
- Lint, typecheck, 53 test và production build đạt. Edge production kiểm tra riêng Thiết lập ở 360/390/820/1440 px đạt: đủ chín nhóm, validation, lưu/revision, JSON, đổi mode, giữ phiên/reset, không tràn ngang; đã xem ảnh desktop/mobile. Full smoke đạt các luồng hiện có với 72 bố cục và 27 bố cục dữ liệu mẫu, không lỗi runtime/React. Browser trong sandbox không khởi động được; kiểm tra ngoài sandbox dùng profile riêng đạt. Đã kiểm tra link nội bộ và diff. Chưa có runner, benchmark, training hoặc telemetry thật; bước tiếp theo về API upload/ingestion và quyền cho RAG baseline không đổi.

## 2026-10-29 — Thu gọn bảng so sánh

- Giảm hàng từ 88 xuống 64 px, giảm padding dọc còn 8 px (mobile 6 px), giữ căn giữa và các hàng đồng đều. Cập nhật thiết kế frontend.
- Lint và Edge dev desktop/mobile đạt: hàng bằng chiều cao, không tràn ngang, màu/đơn vị giữ đúng. Đã rà diff; chưa chạy lại production build cho thay đổi CSS này.

## 2026-10-28 — Cân đối chiều cao hàng so sánh

- Đặt sáu hàng nội dung cao 88 px và giữ căn giữa. Cập nhật thiết kế frontend; lint và Edge dev desktop/mobile đạt, xác nhận sáu hàng bằng chiều cao, giữ màu/đơn vị và không tràn ngang. Chưa chạy lại production build cho thay đổi CSS này.

## 2026-10-28 — Cách vẽ biểu đồ theo mẫu tham khảo

- Tăng chiều cao vùng vẽ, làm nhẹ lưới ngang, dấu điểm màu đặc viền trắng, trục giá trị rút gọn có khoảng trống trên đỉnh. Thêm tooltip hai nhánh theo truy vấn khi rê/chạm, bấm chọn đồng bộ thanh truy vấn; giữ màu hiện hành và dữ liệu gốc, đoạn trùng đan màu.
- Lint/typecheck đạt. Edge dev kiểm tra ba chỉ số, tooltip/chọn điểm, đoạn trùng, nguồn rỗng và bố cục desktop/mobile; đã xem ảnh và rà diff. Cập nhật thiết kế frontend; chưa chạy lại production build/full smoke.

## 2026-10-28 — Dữ liệu mẫu đủ hơn, bằng, kém

- Bảng mặc định có Cache tốt hơn về hiệu suất, Không cache tốt hơn về chất lượng (100% so với 95,8%), hai hàng quyền bằng nhau (0%). Lưu nhãn chất lượng riêng từng nhánh trong fixture; các tab và bộ lọc cùng tính từ dữ liệu này. Cập nhật thiết kế frontend.
- Lint, typecheck và 49 test đạt; Edge dev kiểm tra màu hai bên, hàng bằng nhau trung tính, đơn vị/mẫu số, lọc và nguồn phiên ở desktop/mobile. Đã xem ảnh và rà diff; chưa chạy lại production build/full smoke cho lần thay fixture này.

## 2026-10-28 — Tăng độ phân biệt màu vòng cache

- Đổi Hit sang xanh lá #16a34a, Miss sang xanh dương #2563eb, Rejected sang đỏ hồng #e11d48; đồng bộ vòng/chú giải ở Chung và Cache. Cập nhật thiết kế frontend.
- Lint và kiểm tra Edge dev desktop/mobile đạt: màu khớp, số đếm giữ nguyên, không tràn ngang hoặc lỗi runtime. Chưa chạy lại production build cho thay đổi CSS này.

Các mốc ngày tháng bên dưới là lịch sử tại thời điểm thực hiện; mục mới hơn thay thế định hướng cũ khi có thay đổi. Phạm vi và bước tiếp theo hiện hành được tổng hợp ở cuối file.

## 2026-10-28 — Đồng bộ hai đường biểu đồ

- Đồng nhất kích thước/nền dấu điểm của Không cache và Cache, giữ nét liền cùng độ dày và chung thang đo. Điểm trùng chia viền hai màu, đoạn trùng giữ đan màu; không đổi số liệu.
- Lint/typecheck đạt. Edge dev kiểm tra ba chỉ số ở desktop/mobile, kích thước điểm, nét, lớp đan màu và nguồn rỗng; đã xem ảnh và rà diff. Cập nhật thiết kế frontend; chưa chạy lại production build cho thay đổi trình bày này.

## 2026-10-28 — Sửa lỗi dữ liệu biên trên dashboard

- Không tô bên tốt hơn khi hai số hiển thị bằng nhau sau làm tròn; chặn số âm, NaN/Infinity và tỷ lệ ngoài giới hạn hoặc không khớp số ca. Ẩn số ca đi kèm tỷ lệ không hợp lệ.
- Tập mẫu rỗng dùng — cho số đo/đánh giá chưa có, bỏ 0/0; thẻ rò rỉ không suy ra 0 khi thiếu ca quyền. Vòng cache không có lượt tra giữ trung tính thay vì thành vòng Rejected đỏ.
- Thêm bốn ca hồi quy, tái hiện lỗi trước khi sửa. Lint, typecheck, 49 test và production build đạt; render component xác nhận số làm tròn/tỷ lệ sai/vòng rỗng. Edge production smoke đạt 72 bố cục hiện có và 27 bố cục mẫu cùng các luồng Chat/Số liệu/Tài liệu, không lỗi runtime. Đã rà diff và ảnh mobile, cập nhật thiết kế frontend; chưa kiểm chứng browser khác hoặc dữ liệu đo thật.

## 2026-10-28 — Bỏ công tắc dữ liệu mẫu trên dashboard

- Bỏ Xem dữ liệu mẫu và dòng mô tả nguồn trên toolbar; mặc định vẫn giữ 24 truy vấn giả, bộ lọc và cả ba tab. Không thêm banner thay thế; các nhãn mẫu tại biểu đồ/chi tiết vẫn giữ.
- Giữ nguồn phiên Chat tách biệt tại `/metrics?source=session` cho phát triển/kiểm thử, dùng query client với Suspense; chuyển nguồn/Back không trộn fixture vào Chat, reset bộ lọc/tab/biểu đồ/bảng. Không đổi API hoặc cách lưu phiên.
- Lint, typecheck, 45 test và production build đạt. Edge dev kiểm tra ba tab ở desktop/mobile, bỏ đúng điều khiển/mô tả, giữ số liệu mẫu/lọc, nguồn phiên và Back. Edge production smoke đạt 72 bố cục hiện có và 27 bố cục mẫu, các luồng Chat/ba tab/lọc/chi tiết/keyboard; không lỗi runtime. Đã rà ảnh, link/diff và cập nhật README, thiết kế frontend, setup; chưa kiểm chứng browser khác hoặc hiệu quả cache thật.

## 2026-10-28 — Bảng so sánh cùng đơn vị và màu từng nhánh

- Chỉ giữ sáu hàng đối chiếu trực tiếp: độ trễ ms, calls lượt, token và ba tỷ lệ % (câu trả lời đạt yêu cầu, disclosure, false denial). Bỏ Cache Status, Kiểm tra quyền và Semantic false hit khỏi bảng; các thông tin riêng cache/quyền vẫn nằm ở chart, tab nhánh và chi tiết.
- Mỗi hàng dùng một đơn vị chung cho cả hai cột. Fixture tỷ lệ có số ca/mẫu số cùng tập ở hai bên; không có ca thì unknown. Tỷ lệ khác/thiếu mẫu số không được đánh dấu tốt hơn. Ô tốt hơn theo màu nhánh: Không cache xanh dương, Cache nâu cam, bằng nhau/unknown giữ trung tính. Chưa chốt telemetry hoặc công thức đánh giá thật.
- Kiểm chứng: lint, typecheck, 45 test logic và production build đạt. Render component thật và Edge dev xác nhận cả hai bên tốt hơn/màu/độ đậm, sáu hàng/đơn vị/mẫu số, lọc, unknown và desktop/mobile. Edge production smoke đạt 72 bố cục hiện có và 27 bố cục dữ liệu mẫu, cùng luồng Chat/ba tab/lọc/chi tiết/cập nhật phản hồi/keyboard, không lỗi runtime. Đã rà ảnh, link và diff; chưa kiểm chứng browser khác hoặc hiệu quả cache thật.
- Cập nhật thiết kế frontend; bước tiếp theo về baseline/telemetry thật không đổi.

## 2026-10-28 — Dữ liệu mẫu để xem dashboard

- Theo yêu cầu xem giao diện có số liệu, bật mặc định Xem dữ liệu mẫu tại Số liệu, kèm nhãn dữ liệu giả/không phải kết quả đo; tắt để quay lại dữ liệu phiên Chat. Giữ ba tab trên đầu và các phần đã tinh gọn.
- Fixture cố định 24 truy vấn/hai nhánh trong hai hội thoại, gồm 15 Hit, 7 Miss, 2 Rejected sinh lại. Thẻ, ba loại đường, vòng cache, bảng so sánh tô xanh giá trị tốt hơn, chất lượng/quyền và chi tiết dùng cùng nguồn; lọc tính lại mẫu số. Không ghi fixture vào Chat, cache, storage hoặc kết quả đánh giá; chưa thêm backend/telemetry hay chốt công thức nghiên cứu thật.
- Kiểm chứng: lint, typecheck, production build và 43 test logic đạt. Edge production smoke đạt 72 bố cục hiện có và 27 bố cục dữ liệu mẫu ở chín kích thước; kiểm tra riêng chọn truy vấn/đổi ba chỉ số, màu/độ đậm, chi tiết, lọc và đổi nguồn; không lỗi React/runtime. Đã rà ảnh toàn trang desktop/mobile, tài liệu/link và diff. Chưa kiểm chứng trình duyệt khác hoặc hiệu quả cache thật.
- Cập nhật README, thiết kế frontend và hướng dẫn chạy. Baseline thật, telemetry và tiêu chí đánh giá có dữ liệu đo vẫn là bước tiếp theo.

## 2026-10-28 — Biểu đồ đường hiệu suất theo số truy vấn

- Hiển thị hiện hành: cả hai đường nét liền; phần chồng nhau xen kẽ màu trên nét liên tục, chỉ tại vùng giao, giữ khoảng thiếu dữ liệu. Cập nhật thiết kế frontend; lint/typecheck, 43 test và production build đạt; Edge dev kiểm tra ba chỉ số, mask đoạn trùng, dữ liệu rỗng và ảnh desktop/mobile. Chưa chạy lại production smoke đầy đủ cho thay đổi nét vẽ này.
- Thay biểu đồ thanh tổng hợp ở Chung bằng hai đường Không cache/Cache theo số truy vấn. Chọn độ trễ/lượt gọi/token từng lượt, thanh chọn Truy vấn hỗ trợ bàn phím/cảm ứng và đọc hai giá trị. Hai tab riêng giữ biểu đồ thanh, bỏ khối tổng lượt gọi LLM và ghi chú dưới biểu đồ. Lần tinh gọn này đã kiểm tra lint/typecheck và Edge dev ở bốn kích thước; chưa chạy lại build hoặc bộ production smoke đầy đủ.
- Thêm sequence nội bộ cho lượt gửi để giữ thứ tự xuyên hội thoại. Một lượt Cả hai chỉ có một vị trí; không gộp prompt trùng hoặc loại lượt chờ/lỗi. Lọc theo hội thoại đánh lại X từ 1; nhánh không chạy/thiếu hoặc lỗi số đo tạo khoảng trống, không nối giả. Độ trễ chưa đo không vẽ đường; usage demo 0 không được coi là số đo hiệu quả cache. Chưa thêm telemetry/API, timestamp hoặc benchmark.
- Kiểm chứng: lint, typecheck, production build và 41 test logic đạt. Edge production smoke đạt đổi chỉ số, chọn lượt, nhánh không chạy, bảng/ba tab và 72 bố cục hiện có. Kiểm tra riêng thứ tự gửi qua nhiều hội thoại, câu trùng, lọc/reset, chọn bằng bàn phím, không bịa thời gian và bốn kích thước desktop/mobile; không lỗi React/hydration. Đã rà ảnh, link/diff. Chưa kiểm chứng browser khác hoặc lợi ích cache bằng dữ liệu đo thật.
- Cập nhật README, thiết kế frontend và setup. Baseline thật/telemetry vẫn là bước tiếp theo.

## 2026-10-28 — Sáu chỉ số tổng quan của tab Chung

- Thay bốn thẻ cũ bằng Total Queries, Safe Cache Hit Rate, Latency Reduction, LLM Calls Saved, Tokens Saved và Security Violations, với mô tả tiếng Việt theo yêu cầu. Desktop xếp ba cột/hai hàng, màn hẹp hai cột/ba hàng; hai tab riêng giữ bốn thẻ.
- Total Queries đếm lượt gửi theo bộ lọc, không đếm đôi khi chạy hai nhánh, không gộp prompt trùng. Bỏ dòng tổng lượt gửi/lượt có cả hai nhánh phía trên các thẻ, giữ số tại Total Queries. Các tỷ lệ/mức tiết kiệm/vi phạm chưa có phép đo ghi —, không suy ra từ usage demo 0 hoặc trạng thái phản hồi. Chưa chốt công thức/mẫu số/đơn vị giảm hoặc cơ chế xác nhận trả cache trái quyền; chưa thêm telemetry/API.
- Kiểm chứng: lint, typecheck và production build đạt. Edge dev kiểm tra đủ sáu nhãn/mô tả, tổng câu hỏi qua hai nhánh/câu trùng/nhiều hội thoại/bộ lọc, giữ năm chỉ số chưa đo, chuyển tab và bố cục bốn kích thước; đã rà ảnh desktop/mobile, link/diff. Chưa chạy lại bộ production smoke đầy đủ hoặc kiểm chứng browser khác. Cập nhật thiết kế frontend; baseline thật vẫn là bước tiếp theo.

## 2026-10-28 — Đối chiếu tiêu chí ở giữa và đánh dấu giá trị tốt hơn

- Đổi Đối chiếu chi tiết trong tab Chung thành bảng Không cache / Tiêu chí / Cache, tên chỉ số chỉ xuất hiện ở giữa, hai giá trị cùng hàng. Tách P50/P95 thành hai hàng (11 hàng tổng cộng); số mẫu ở tiêu đề và trạng thái phản hồi ở dưới. Giữ ba cột trên mobile.
- Giá trị tốt hơn in đậm, chữ/nền xanh; lựa chọn theo chiều chỉ số, chỉ khi có hai giá trị hợp lệ và phép đo tương đương. Bằng nhau, thiếu/lỗi dữ liệu, khác điều kiện hay trạng thái cache/quyền giữ trung tính. Demo chưa có cặp đo tương đương nên không chọn bên thắng. Tách model trình bày khỏi UI; chưa chốt telemetry/API, rubric hoặc dữ liệu benchmark.
- Kiểm chứng: lint, typecheck, production build và 38 test logic đạt. Edge production smoke đạt bảng ba cột/nhãn giữa, lọc/chi tiết/ba tab và 72 bố cục hiện có. Render component thật và Edge kiểm tra thêm cả hai bên tốt hơn, bằng nhau/unknown/khác điều kiện, màu/độ đậm ở bốn kích thước bằng fixture riêng trong test-results, không đưa số liệu giả lập vào app. Đã rà ảnh desktop/mobile, link/diff; chưa kiểm chứng browser khác.
- Cập nhật README, thiết kế frontend và setup. Baseline thật/telemetry vẫn chưa triển khai; bước tiếp theo không đổi.
- Tinh gọn theo yêu cầu: bỏ Chi phí, gộp P50/P95 thành Độ trễ (9 hàng), thống nhất nhãn ở thẻ/biểu đồ; bỏ tiêu đề Đối chiếu chi tiết, dòng mô tả, số lượt chạy ở tiêu đề, dòng đếm hoàn tất/đang chờ/lỗi và ghi chú phản hồi mẫu/timeout. Giữ thanh trạng thái và nhãn truy cập. Độ trễ vẫn chưa đo, chưa chọn công thức tổng hợp; giữ đặc tả nghiên cứu riêng. Lint/typecheck đạt; Edge dev xác nhận bỏ đúng nội dung, bảng bắt đầu panel, ba cột/màu/độ đậm và bố cục bốn kích thước; đã rà ảnh/diff, cập nhật thiết kế frontend. Chưa chạy lại build hoặc bộ production smoke đầy đủ cho lần tinh gọn này.

## 2026-10-28 — Chat mặc định Cả hai và thống nhất nhãn Cache

- Đổi nhãn Có cache thành Cache trong Chat, Thông số và Số liệu; đổi So sánh chia đôi thành Cả hai. Mở phiên/tải lại mặc định chạy cả hai nhánh bằng một prompt; Chat mới tiếp tục kế thừa chế độ đang chọn. Giữ giá trị nội bộ no-cache/cache/compare, dữ liệu lượt gửi và logic hai nhánh.
- Kiểm chứng: lint, typecheck, production build và 35 test logic đạt. Bổ sung test mặc định/gửi hai nhánh; fixture một nhánh chọn rõ Không cache. Edge production smoke đạt mặc định, nhãn mới, gửi hai nhánh, reset, ba chế độ, Thông số/Số liệu/Tài liệu, keyboard và 72 bố cục hiện có; kiểm tra thêm mặc định Cả hai tại chín kích thước. Đã rà ảnh desktop/mobile, link và diff; chưa kiểm chứng browser khác.
- Cập nhật README, thiết kế frontend và setup. AI/cache vẫn mô phỏng; bước tiếp theo của baseline thật không đổi.

## 2026-10-28 — Ba tab Số liệu và đối chiếu hai cột

- Chia dashboard thành Chung / Không cache / Cache, dùng lại Tabs có hỗ trợ bàn phím. Chung giữ biểu đồ/chỉ số chính ở trên, hai cột đối chiếu cùng thứ tự mười chỉ số ở dưới, kể cả trên mobile. Hai tab riêng chỉ hiển thị biểu đồ, chất lượng/quyền và lượt thực sự chạy nhánh tương ứng; lượt chia đôi thuộc cả hai tab nhưng chỉ đếm một lần ở Chung.
- Bộ lọc hội thoại/lượt gửi dùng chung qua chuyển tab; phân trang/chi tiết và biểu đồ riêng từng panel, đổi bộ lọc reset bảng. Tách bảng lượt gửi thành component dùng chung, lọc nhánh trong model. Giữ ý nghĩa chưa đo/chưa chấm/chưa xác minh, không thêm số liệu giả, dependency, API hoặc quyết định bảo mật.
- Kiểm chứng: lint, typecheck, build và 34 test logic đạt; test model bổ sung lọc nhánh/giữ ordinal/lượt trùng. Edge production smoke đạt ba tab, bàn phím, giữ bộ lọc, số mẫu/bảng/biểu đồ/chi tiết đúng nhánh, ID không trùng, hai cột và 72 bố cục tại chín kích thước. Bản cuối tách disclosure/false denial được kiểm tra thêm ba tab/mười chỉ số/hai cột ở bốn kích thước, không lỗi React/hydration; đã rà ảnh desktop/mobile, link và diff. Chưa kiểm chứng browser/thiết bị khác.
- Cập nhật README, thiết kế frontend và setup. Baseline thật và telemetry/nhãn đánh giá vẫn chưa triển khai; bước tiếp theo không đổi.
- Tinh gọn đầu trang: ba tab ở trên cùng, bỏ tiêu đề hiển thị/nhãn phiên/câu mô tả, dòng thông báo phản hồi mẫu và ô Lượt gửi. Chỉ còn bộ lọc Hội thoại, tổng hợp mọi lượt gửi của hội thoại đã chọn; cập nhật browser smoke tương ứng. Lint/typecheck đạt; Edge dev kiểm tra ba tab, bỏ đúng nội dung, thứ tự focus và bố cục tại bốn kích thước, không lỗi React/hydration; đã rà ảnh/diff và đồng bộ README, thiết kế/setup. Chưa chạy lại build hoặc bộ production smoke đầy đủ cho lần bỏ ô lọc/thông báo.

## 2026-10-28 — Dashboard Số liệu theo tiêu chí đánh giá đồ án

- Thêm `/metrics` và điều hướng Chat → Số liệu → Tài liệu. Dashboard có lọc hội thoại/lượt so sánh, thẻ chỉ số, biểu đồ hai nhánh/kết quả cache/trạng thái phản hồi, bảng chất lượng/phân quyền và chi tiết từng lượt với phân trang. Dùng cùng phiên Chat và năm thông số hiện có; không thêm dependency hoặc API.
- Bám tốc độ, model calls/token/chi phí, hit hợp lệ, semantic false hit, chất lượng có nguồn hỗ trợ, disclosure và false denial. Chỉ tổng hợp số lượt/trạng thái demo; nhánh không chạy không có usage giả. Chưa đo thời gian, cache/quyền hoặc chấm chất lượng; chi phí chưa ước tính. Vẫn chưa có benchmark, cold/warm, phân tách local/server hoặc lưu run.
- Kiểm chứng: lint, typecheck, production build và 34 test logic đạt. Edge production smoke đạt bộ lọc, prompt trùng/an toàn hiển thị, đồng nhất thông số Chat, nhánh không chạy, phân trang, phản hồi hoàn tất khi xem Số liệu, reset phiên, mobile/keyboard và 54 bố cục tại chín kích thước. Đã sửa và xác nhận hết hydration mismatch của tiêu đề SVG, rà ảnh desktop/mobile, link nội bộ và diff. Chưa kiểm chứng browser/thiết bị khác.
- Cập nhật README, tổng quan, thiết kế frontend và setup. Bước tiếp theo vẫn là hợp đồng upload/ingestion, lưu trữ và quyền cho baseline thật; telemetry và nhãn đánh giá cần đặc tả khi nối backend.

## 2026-10-28 — Lịch sử thu gọn dưới mục Chat

- Đưa Chat mới và lịch sử vào ngay dưới mục Chat, trước Tài liệu. Bấm Chat/mũi tên để mở hoặc thu gọn, chuyển động chiều cao/độ mờ và tôn trọng giảm chuyển động. Mỗi lần mở hiện 5 hội thoại mới tạo nhất; Hiển thị thêm mở tiếp từng nhóm 5 đến hết.
- Giữ trạng thái chọn, bản nháp và chế độ; chọn lịch sử từ Tài liệu mở đúng hội thoại. Trên mobile, mở danh sách giữ drawer, chọn hội thoại/Chat mới đóng drawer; danh sách thu gọn không nhận focus. Lịch sử vẫn chỉ lưu trong phiên và mất khi reload.
- Kiểm chứng: lint, typecheck, production build và 31 test logic đạt. Edge production smoke đạt danh sách 5 → 10 → 13, ẩn Hiển thị thêm khi hết, thu gọn/mở lại về 5, giữ bản nháp/chọn từ Tài liệu, bàn phím/mobile/giảm chuyển động và 45 bố cục hiện có; đã rà ảnh desktop/mobile và diff. Chưa kiểm chứng browser khác.
- Cập nhật thiết kế frontend và hướng dẫn sử dụng; không đổi API, cache hoặc dữ liệu hội thoại. Bước tiếp theo của baseline thật vẫn là hợp đồng upload/ingestion, lưu trữ và quyền.

## 2026-10-28 — Cửa sổ Thông số theo lượt gửi

- Nút Thông số chỉ hiện biểu tượng, nằm ngay bên trái bánh răng cài đặt trong cùng một nhóm sát góc phải, cách nhau 4 px trên desktop/mobile. Nút mở modal hai cột Không cache/Có cache với năm trường: Cache Status, thời gian phản hồi, lượt gọi LLM, token LLM và kiểm tra quyền. Dropdown lấy lượt gửi trong hội thoại hiện tại, mới nhất trước và mặc định chọn lượt gần nhất mỗi lần mở; prompt trùng vẫn là các lượt riêng.
- Tinh gọn theo yêu cầu mới: bỏ icon trang trí, dòng “Chưa đo AI/cache. LLM chưa được gọi.”, nền/viền xanh dương/tím và nhãn Mô phỏng trong Thông số/thanh đầu trang. Đổi cách ghi trong menu/lỗi sang phản hồi mẫu, bỏ CSS nhãn cũ và giữ các nút ở góc phải. Giữ hai bảng trắng, tiêu đề chữ đậm và màu chữ theo từng nhóm chỉ số, dùng cùng màu ở cả hai nhánh. Giữ các hàng thẳng nhau khi nhãn nhánh không chạy xuống dòng; màu chữ không thể hiện Hit hoặc ALLOW giả.
- Lưu ID, prompt, chế độ và trạng thái/lỗi từng nhánh theo lượt; một lượt chia đôi chỉ có một mục. Đổi chế độ/xem hội thoại khác không ghép lại dữ liệu cũ; bỏ qua phản hồi trễ/trùng và ID lượt đã dùng. Có trạng thái chưa gửi, đang chờ, nhánh không chạy và reset khi reload.
- Chỉ là frontend mô phỏng: cache/thời gian/quyền chưa có kết quả thật; baseline cache ghi Không áp dụng, nhánh không chạy ghi Không chạy. Lượt gọi/token LLM bằng 0 vì demo không gọi model, không dùng độ trễ mẫu làm số đo AI/cache. Chưa thêm API hoặc chốt schema telemetry/quyền.
- Kiểm chứng: lint, typecheck, production build và 31 test logic đạt; Edge production smoke đạt chọn lượt mới nhất/cũ/trùng, cập nhật phản hồi, tách hội thoại, mở/đóng/focus, không bịa số đo/quyền và 45 bố cục tại chín kích thước. Đã rà ảnh desktop/mobile, link và diff. Cập nhật README, thiết kế frontend/setup; chưa kiểm chứng browser/thiết bị khác. Bước tiếp theo vẫn là hợp đồng upload/ingestion, lưu trữ và quyền cho baseline thật.
- Kiểm chứng lần tinh gọn: lint, typecheck và build đạt; Edge production kiểm tra hai nhánh chạy/một nhánh không chạy tại bốn kích thước (8 trường hợp), không tràn ngang và các hàng chỉ số thẳng nhau. Đã rà ảnh desktop/mobile, link/diff và tương phản sáu màu chữ trên nền trắng (đều trên 5,9:1). Không đổi logic dữ liệu; chưa chạy lại bộ smoke đầy đủ hoặc kiểm chứng browser khác cho lần tinh gọn này.
- Lần bỏ nhãn và gom biểu tượng: lint/typecheck đạt; Edge dev kiểm tra nhóm Thông số/cài đặt tại chín kích thước, sát góc phải, cùng hàng và cách nhau 4 px; mở modal/menu, Escape/focus hoạt động. Đã cập nhật thiết kế/setup và kiểm tra link/diff; chưa chạy lại build hoặc bộ smoke đầy đủ cho thay đổi bố cục nhỏ này.

## 2026-10-27 — Đồng nhất thanh nhập và phân chia hai nhánh

- Cả ba chế độ dùng cùng một thiết kế thanh nhập, chiều rộng tối đa 1120 px; textarea và nút Gửi nằm cạnh nhau trong viền chung. Bỏ hàng nút riêng, thống nhất placeholder, chuyển lỗi nhập rỗng xuống dưới thanh.
- Ô nhập tự giãn từ 44 đến 160 px theo nội dung/chiều rộng màn hình rồi cuộn, thu gọn sau gửi; nút Gửi bám cạnh dưới khi có nhiều dòng. Giữ Enter gửi và Shift+Enter xuống dòng, logic hai nhánh và lịch sử trong phiên.
- Bổ sung vạch dọc 1 px giữa hai nhánh khi chia đôi, dừng trước thanh nhập, không thêm viền bao quanh hoặc chặn thao tác. Kiểm chứng bổ sung: lint và Edge dev ở ba chế độ/chín kích thước đạt; đã rà ảnh desktop/mobile, link và diff. Hai chế độ đơn không hiện vạch.
- Kiểm chứng: lint, typecheck, production build và 27 test logic đạt; Edge smoke đạt ô nhập/Gửi cùng hàng, cùng kích thước qua ba chế độ, tự giãn/thu gọn, Shift+Enter và 36 bố cục tại chín kích thước. Đã rà ảnh desktop/mobile, link tài liệu và diff; cập nhật thiết kế frontend/setup. AI/cache vẫn mô phỏng; chưa kiểm chứng browser/thiết bị khác.

## 2026-10-27 — Nới vùng chat và tối giản phần điều khiển

- Bỏ tiêu đề hiển thị Chat nội bộ, nhãn chế độ lặp, nhãn Mô phỏng từng khung, lời nhắc ở vùng so sánh trống và tên vai trò lặp trên tin nhắn. Giữ nhãn Không cache/Có cache để phân biệt hai bên, nhãn mô phỏng chung và tên truy cập cho trình đọc màn hình.
- Bỏ viền/nền card/đường kẻ tiêu đề của hai vùng so sánh, giảm padding ngoài và đưa icon cài đặt 16 px không viền lên góc phải thanh trên cùng. Giữ vùng bấm 32 px trên desktop, 44 px với con trỏ cảm ứng; không đổi logic gửi hoặc lưu lịch sử trong phiên.
- Kiểm chứng: lint, typecheck, production build, 27 test logic và Edge smoke trên 27 bố cục đạt. Đã kiểm tra menu bằng phím mũi tên/Tab/Escape và cảm ứng, rà ảnh desktop/mobile, link tài liệu và diff. Cập nhật thiết kế frontend/setup; giới hạn AI/cache mô phỏng và browser/thiết bị khác vẫn như trước.

## 2026-10-27 — Chọn chế độ và so sánh ngay trong Chat

- Thêm nút bánh răng chọn Không cache, Có cache hoặc So sánh chia đôi. Hai khung Không cache/Có cache cuộn riêng, dùng một ô nhập gửi cùng prompt sang hai nhánh song song; giữ bố cục hai cột cả ở màn nhỏ.
- Chế độ, bản nháp và lịch sử từng nhánh giữ theo hội thoại trong phiên; chat mới kế thừa chế độ với lịch sử rỗng. Khóa đổi chế độ/tạo chat khi chờ; theo dõi ID lượt và từng nhánh để bỏ qua phản hồi trễ/trùng, giữ kết quả nhánh thành công khi nhánh kia lỗi.
- Kiểm chứng: lint, typecheck, production build và 27 test logic đạt; Edge production smoke đạt ba chế độ, prompt chung, lịch sử riêng, giữ phiên qua route, an toàn hiển thị văn bản, sao chép, luồng Tài liệu/UI kit và 27 bố cục tại chín kích thước. Đã kiểm tra riêng radio bằng phím mũi tên, Tab/Escape, click ngoài và rà ảnh desktop/mobile của menu/chia đôi.
- Cập nhật README, tổng quan, thiết kế frontend và setup. Vẫn chỉ là UI/phản hồi mẫu; chưa có AI/RAG, lookup/reuse cache hoặc số đo thật; chưa chốt local/server và chưa kiểm chứng browser/thiết bị khác. Bước tiếp theo vẫn là hợp đồng upload/ingestion, lưu trữ và quyền cho baseline thật.

## 2026-10-27 — Chẩn đoán hydration warning trên body

- Log người dùng gửi có `__processed_…`, `bis_register`, `bis_skin_checked` và class `mdl-js`; source ứng dụng và HTML trả về từ dev server không sinh các dấu này. Đối chiếu extension cài trong Cốc Cốc: ID giải mã từ `bis_register` khớp 1ClickVPN Proxy for Chrome 1.17.15, có script xử lý/chèn thuộc tính `bis_*`; eJOY AI Dictionary 7.2.0 đăng ký content script trên mọi website với mã thêm `mdl-js` vào html.
- Kiểm chứng Edge trên bản dev: Chat/Tài liệu không có console error với profile sạch; mô phỏng chèn thuộc tính trước hydration tái hiện cảnh báo ở cả hai route; bỏ mô phỏng và tải lại Chat không còn cảnh báo. Không sửa logic ứng dụng cho sai khác do tác nhân bên ngoài.
- Bổ sung [cách xử lý trong setup](setup.md#hydration-warning-do-trình-duyệt-sửa-html), gồm hai extension đã đối chiếu trên máy. Chưa thay đổi cấu hình trình duyệt; còn cần tắt hoặc giới hạn hai extension rồi xác nhận lại trên profile đang gặp lỗi.

## 2026-10-27 — Rà soát lỗi và đồng bộ trạng thái

- Sửa phần tổng hợp còn ghi ba màn hình nghiên cứu và thứ tự công việc cũ; đồng bộ với ưu tiên Chat/Tài liệu, upload/ingestion và quyền nạp/đọc. Giữ các mốc cũ làm lịch sử, không coi là phạm vi hiện hành.
- Kiểm chứng lại: frontend lint, typecheck, production build và 20 test logic đạt; backend Ruff và 2 test health/CORS đạt; Edge smoke đạt luồng Chat/Tài liệu, UI kit, keyboard và 18 bố cục. Chưa tái hiện lỗi ứng dụng trong các kiểm tra này.
- Edge trong sandbox không khởi động được; lượt kiểm tra ngoài sandbox đạt. Vẫn có cảnh báo Node tự nhận dạng ES module và deprecation TestClient/httpx, không làm test thất bại. Chưa kiểm chứng lại database hoặc browser/thiết bị khác.
- Bước tiếp theo vẫn là chốt hợp đồng upload/ingestion, lưu trữ và quyền để nối baseline thật; không thay đổi phạm vi sản phẩm.

## 2026-10-27 — Ưu tiên Chat nội bộ và Tài liệu

- Theo yêu cầu mới, app chỉ có hai khu chính: Chat tại `/` và Tài liệu tại `/documents`. Lịch sử nằm trong cùng sidebar; bỏ A/B, thí nghiệm và tham số kỹ thuật khỏi luồng chính. `/chat`, `/settings`, `/experiments` chuyển về Chat; mã nghiên cứu trước đó được giữ riêng để dùng sau.
- Chat dùng tình huống nội bộ và giữ hội thoại/bản nháp qua điều hướng. Tài liệu có chọn/thả nhiều tệp, phân loại mặc định/từng tệp, tìm/lọc, bỏ khỏi danh sách; kiểm tra định dạng, tệp trống, 20 MB/tệp và metadata trùng. Phân loại chỉ để sắp xếp, không cấp quyền.
- Tệp chỉ giữ trong bộ nhớ phiên, luôn ghi Chờ tải lên; chưa upload, parse/embed hoặc cấp nguồn cho chatbot. Chat vẫn trả lời mẫu, backend vẫn chỉ có health. Không thêm dịch vụ/dependency hoặc schema API nghiệp vụ.
- Kiểm chứng: lint, typecheck, production build và 20 test logic đạt; Edge smoke đạt luồng Chat/tệp, phân loại, validation/trùng, giữ phiên, redirect, UI kit, bàn phím và 18 bố cục hai màn tại chín kích thước. Đã rà ảnh desktop/mobile, link và diff; chưa kiểm tra browser/thiết bị khác.
- Cập nhật README, tổng quan, thiết kế frontend và setup. Bước tiếp theo: chốt API upload/ingestion, lưu trữ và quyền nạp/đọc để nối baseline thật; A/B, benchmark và thiết lập mở rộng tiếp tục hoãn.

## 2026-10-27 — Tối giản giao diện

- Bỏ slogan, nhãn bước, chú thích/bảng điều kiện lặp và nút chưa có chức năng. Ba màn chỉ giữ form, A/B, kế hoạch và hành động chính; Tài nguyên và tham số Nâng cao mặc định gấp lại. Mô phỏng/giới hạn lưu trong phiên được thông báo qua một nhãn chung.
- Giữ snapshot, xuất kế hoạch và validation; sửa câu hỏi xóa bản xem trước cũ. Sửa vòng focus drawer để bỏ qua link trong nhóm thu gọn; nhóm Nâng cao tự mở khi có trường lỗi. Cập nhật thiết kế frontend và hướng dẫn sử dụng.
- Kiểm chứng: lint, typecheck, production build, 13 test logic và Edge smoke trên 45 bố cục đạt; đã rà ảnh desktop/mobile và link/diff. Vẫn là frontend mô phỏng, chưa nối backend; giới hạn browser/Node như mục bên dưới.

## 2026-10-27 — Bố cục web theo luồng nghiên cứu

### Đã triển khai

- Đưa So sánh chatbot A/B, Thí nghiệm và Cấu hình & quyền thành ba màn chính; nhận diện CacheSec trên nền thiết kế Nói. `/ui` và chat mẫu `/chat` chuyển vào nhóm tài nguyên phụ.
- Trang chính có điều kiện/câu hỏi chung, chọn hai profile, nội dung/nguồn mẫu và số đo để trống đúng trạng thái; không giả lập hit, quyền hợp lệ, thời gian hay chi phí.
- Sửa/lưu profile nháp có revision trong phiên; lưu kế hoạch gồm workload, số lần lặp, cold/warm, seed và snapshot hai profile. Xuất JSON kế hoạch riêng, kết quả vẫn `null`; sửa profile không đổi snapshot cũ.
- Tách UI ba màn và state/validation/fixtures dùng chung; giữ UI kit và test chat trước đó. Cập nhật [thiết kế frontend](../frontend/design.md), [cách chạy](setup.md) và README.

### Đã kiểm chứng

- Lint, TypeScript, production build và 13 test logic đạt. Test bao phủ validation, snapshot độc lập, số lượt dự kiến và không tạo số đo/quyền giả.
- Edge headless: luồng A/B, sửa/lưu profile qua route, lưu/xuất JSON kế hoạch, snapshot sau lần sửa tiếp theo, reset khi tải lại, UI kit/chat mẫu, keyboard/focus, clipboard fallback và reduced motion đạt; không ghi nhận lỗi React/hydration.
- Năm route không tràn ngang tại chín kích thước từ 360×800 đến 1920×1080 (45 bố cục). Đã rà ảnh desktop/mobile của các màn chính; ảnh kiểm chứng nằm trong `frontend/test-results/browser/`, không commit.

### Giới hạn và bước tiếp theo

- Chỉ hoàn thiện frontend bản xem trước và thao tác bản nháp; chưa thêm nghiệp vụ backend, authentication, RAG/model/cache hoặc runner. Nút cần backend được khóa đúng trạng thái. Snapshot frontend chưa phải schema API chốt.
- Các giá trị TTL/similarity/cold/warm là nháp; chưa có quyết định chính sách bảo mật, quy trình reset/preload hay kết quả thực nghiệm. Cần chốt hợp đồng API, dữ liệu và quyền để nối baseline thật.
- Profile/kế hoạch chỉ sống trong phiên; chưa kiểm chứng Safari/Firefox hoặc thiết bị thật. Node test runner còn cảnh báo ES module; build/browser cần quyền tạo process ngoài sandbox.

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

## Định hướng và việc còn mở — hiện hành 2026-11-07

### Đã thống nhất theo yêu cầu người dùng

- CacheSec giữ kiến trúc Secure Local Semantic Cache, đổi bối cảnh sang AI-assisted software development. AI Coding Agent là ứng dụng kiểm chứng; không thay nghiên cứu cache bằng một coding agent thông thường.
- Một thay đổi nghiệp vụ: flag báo giá thiếu ngày hết hạn hợp lệ để con người xem xét. Một safety property: deployment chỉ sau người có thẩm quyền duyệt tường minh đúng change. Không nhầm duyệt code với duyệt báo giá.
- Thí nghiệm chính Developer-guided/AI-assisted theo năm chiều giảng viên; một repo, một fixture, một approval-control implementation và một acceptance threshold định trước. Giá trị threshold, nghĩa ngày hợp lệ và protocol cụ thể chưa chốt.
- Giữ thiết kế embedding/matching/threshold, verification, RBAC/ABAC, authorized RAG/LLM, admission/TTL/eviction/invalidation, provenance/version và logging/evaluation; giữ stack và UI cũ để tái sử dụng.
- Cache verification và approval gate độc lập; enforcement ở backend/control và exact artifact binding là yêu cầu an toàn, chưa có code. Không tự commit, push, deploy hoặc xây lại ứng dụng.
- Tách ứng dụng báo giá, Agent/IDE và lõi cache; contract tích hợp dùng chung cho web và host bên ngoài. Quy tắc và các giới hạn tương thích được ghi tại [kiến trúc](../system/architecture.md#tích-hợp-cachesec-vào-ide-và-agent); chưa có SDK/extension hoặc workflow backend thật.
- Người dùng đã chọn Context Cache trong trình duyệt cho web Workspace trước, adapter IDE sau; ngày YYYY-MM-DD có thật và không trước mốc fixture 2026-11-07; sáu trường báo giá; identity fixture backend quản lý. Developer có quyền Reviewer hiện tại được tự duyệt tường minh đúng artifact; kiểu/parse/quyền chi tiết và protocol còn mở trong hồ sơ T01.

### Đề xuất chưa được xác nhận là quyết định triển khai

Answer Cache giữ làm hướng mở rộng sau lát cắt Context Cache/browser đã được người dùng chọn. AI Cache/No Cache là phép thử phụ; server-cache benchmark, nhiều model/policy/eviction và fine-tune/FL chưa ưu tiên PoC. Deploy PoC có thể là kích hoạt artifact trong môi trường giả lập có gate thật; chi tiết cần xác nhận trước bước phụ thuộc. Acceptance chưa chọn, chờ cô quy định; đề xuất 100% trước đây không phải cấu hình mặc định hoặc ngưỡng đã được duyệt.

### Còn mở và thứ tự tiếp theo

Danh sách quyết định đầy đủ ở [tổng quan](overview.md#giả-định-và-câu-hỏi-mở), tránh ghi lặp: nghĩa ngày/fixture/threshold; baseline tools và số lặp; identity/reviewer authority; vị trí local/model/Agent/tool scope; artifact/approval binding, freshness và deploy threat boundary.

[Lộ trình PoC](implementation-plan.md) hiện chia T01–T17: khóa đầu vào và thiết kế trước, sau đó backend/database/quyền/trace, app nền/fixture, retrieval/model/cache, executor/gate, Agent, UI và runner; cuối cùng mới so sánh chính. Gate phải có trước mọi activation rule mới; không chạy thí nghiệm trước khi hạ tầng, fixture, acceptance và protocol được khóa. Phép thử cache và tích hợp IDE bên ngoài nằm ở nhóm mở rộng riêng.

T02 có đặc tả thiết kế v0.2; nền PostgreSQL/readiness và lát cắt schema/migration/storage báo giá đã có code và kiểm chứng DB thật. Tiếp theo quyền/scope tối thiểu và API báo giá độc lập; T03–T04 tiếp tục dữ liệu/control/artifact còn lại, phần nghiên cứu T01 vẫn chờ xác nhận. Upload/ingestion tài liệu nội bộ không còn là đầu việc bắt buộc trước PoC này.

## Lịch sử tổ chức tài liệu

Trước lần đổi bối cảnh, tài liệu đánh số và file rỗng đã được gom thành 9 file dưới general/system/frontend/evaluation. Ngày 2026-11-02 thêm một kế hoạch PoC làm nơi quản lý công việc tương lai; tài liệu chủ đề hiện có tiếp tục sở hữu yêu cầu/kiến trúc/đánh giá. Các mục 2026-10 ở trên là lịch sử, không mô tả ưu tiên hiện hành.
