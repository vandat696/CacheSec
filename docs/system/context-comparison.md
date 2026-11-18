# Context Cache và so sánh trên Workspace

Cấu hình PoC được người dùng xác nhận ngày 2026-11-18. Fixture/oracle/acceptance và protocol nghiên cứu vẫn chưa khóa. [Cache](cache.md) sở hữu điều kiện reuse; [đánh giá](../evaluation/design.md) sở hữu phương pháp nghiên cứu.

## Cấu hình thực thi

| Mục | Lát cắt đầu |
| --- | --- |
| Payload/intent | Toàn bộ source profile được cấp quyền; host Agent giới hạn ba file. Intent `full-authorized-source`, tách purpose inspect/change; không cache phân tích, patch, test verdict hoặc approval |
| Browser | Dexie/IndexedDB riêng principal/tenant/repo; 100 entry, LRU, TTL 1.800 giây |
| Embedding | Gemini `gemini-embedding-001`, 768 chiều, `SEMANTIC_SIMILARITY`, L2; chỉ gửi prompt giả lập, không gửi source vào embedding API |
| Matching | Exact fingerprint giữ nguyên prompt; semantic cosine ≥ 0,85, top-3. Đây là threshold demo, chưa calibration/acceptance nghiên cứu |
| Namespace | Principal/credential version, tenant/repo/identity, authority epoch, source profile/manifest, purpose/intent, policy, model và prompt version |
| Verification | PostgreSQL registry giữ digest/provenance/vector do backend phát hành; đối chiếu payload và hash/size/path mọi dependency, quyền và source hiện tại |
| Lifecycle | Online verification tại resolve và trước/sau generation; logout/account/source/config đổi xóa entry và đổi epoch browser, chặn request cũ ghi trở lại. Không offline reuse |
| Retention | Lịch sử/registry đã commit giữ tới khi owner chủ động dọn; chưa có xóa/retention tự động |

Provider: [Google embeddings](https://ai.google.dev/gemini-api/docs/embeddings). Payload đầy đủ không có phân tích phụ thuộc prompt; paraphrase chỉ reuse khi toàn bộ binding khớp. Không suy rộng sang summary/selected chunks/Answer Cache.

## Contract đã triển khai

`app/context_cache` độc lập app báo giá và generation provider. `repository_context.py` chuẩn bị source của host; `cached_assistance.py` nối context đã xác minh với cùng adapter generation. Hai nhánh dùng lại controller Agent ba lượt/mười phút, store/proposal/revision/test riêng, cùng snapshot/model/prompt/profile.

| HTTP dưới `/api/v1/agent` | Hành vi |
| --- | --- |
| `GET /config` | Trả model mặc định (`model`) và danh sách ID được backend cho phép (`models`) |
| `POST /context/requests` | Chuẩn bị request gắn prompt/nguồn/identity, TTL request 300 giây; Local mới gọi embedding |
| `POST /context/messages` | Consume request một lần, verify report rồi generation; retry đã consume trả conflict |
| `POST /comparisons` | Idempotency-Key, snapshot/prompt, cold/warm/preload và consent tường minh. `model` tùy chọn, mặc định lấy từ backend. Lưu pair với model trước khi chuẩn bị |
| `POST /comparisons/{id}/{mode}` | Transaction chuyển ready → starting trước consume; retry trả trạng thái, không enqueue lại |
| `GET /comparisons`, `GET /comparisons/{id}` | Lịch sử người tạo còn quyền repository/workflow; tải revision/test/evidence cũ, không gọi model/test lại |
| `POST /comparisons/{id}/{mode}/cancel` | Dừng controller; job đã dispatch có thể còn chạy, giữ reference để kiểm tra |
| `POST /comparisons/{id}/cache-io` | Lưu client-reported write state/timing, gắn đúng admission entry; không thay verifier outcome |

Backend chọn adapter theo ID được phép. Model nằm trong fingerprint của cặp và namespace của context. Khi start nhánh, backend lấy model từ cặp đã lưu, đối chiếu với request context và dùng model đó cho mỗi lượt sửa/test. Entry của model khác bị verifier loại. Lượt standalone context dùng model mặc định. `POST /messages` và `POST /runs` của Agent cũng nhận `model` tùy chọn. URL, key và quyền do backend quản lý.

Standalone context POST chưa có key registry riêng, không tự retry generation. So sánh có resource/key bền riêng.

Browser resolve candidate trước khi chạy hai nhánh. None không mở IndexedDB/lookup/embedding/admission Local. Miss/Rejected fallback bằng retrieval có quyền; authority/verifier/storage backend lỗi trả lỗi. IndexedDB lỗi ghi riêng `client_storage_error`; lỗi embedding ghi cho Local, None vẫn có thể chạy. Không đổi lỗi thành Hit/Miss thành công.

Workspace mở sẵn editor mã nguồn cạnh chat **Cả hai**. Nút đồng hồ trên thanh Agent mở lịch sử trong chính khung Agent. Chọn một phiên để quay lại chat và kết quả đã lưu. **Phiên mới** làm trống chat và đưa hai nhánh về **Chưa chạy**. Phiên chỉ được ghi khi gửi prompt. Trong lúc hai nhánh đang chạy, có thể xem danh sách nhưng cần chờ trước khi đổi phiên. Cuộn xuống để tới **Không cache** và **Có Context Cache**, kể cả trước lượt đầu. Tiến trình, cache hit/miss, lỗi và số liệu nằm cùng bản sửa của từng nhánh. Nền xanh `+` là dòng thêm, nền đỏ `−` là dòng xóa. **Đến dòng sửa** cuộn riêng khung tới thay đổi đầu tiên. Trên màn hình hẹp, hai bản xếp dọc. Bấm **Mở đề xuất trong editor** khi cần chỉnh tiếp.

## Lịch sử và số đo

Migration 006 thêm requests/registry; 007 thêm pairs, immutable revision references và append-only assessments. Source/diff/artifact/evidence dùng snapshot/blob hiện có; registry cache không lưu payload. Checkpoint lưu events/usage/trạng thái từng mốc, không lưu credential.

Technical assessment gắn artifact/evidence và `technical-trace-v1`; các tiêu chí nghiên cứu chưa khóa/chưa thực hiện ghi null kèm lý do. Test kỹ thuật pass không phải acceptance hoặc phê duyệt triển khai.

- Tokens lấy response provider từng lượt; thiếu usage là null. Không suy số calls/tokens tiết kiệm từ Hit.
- `generation_ms`: adapter generation; `embedding_ms`: gồm HTTP embedding; `preparation_ms`: authority/source/embedding trước ghi request.
- `resolution_ms`: verify/retrieval trước commit; `server_workflow_ms`: từ start nhánh tới checkpoint terminal, chưa gồm delivery HTTP/commit cuối.
- `lookup_ms` và cold/warm browser báo nằm trong `client_report`, không phải bằng chứng trusted. Warm/preload khai báo không chứng minh Hit.

Restart không resume model. Nhánh process cũ đang chạy thành incomplete; checkpoint cũ không được ghi đè. Checkpoint failure cũng thành incomplete. Kết quả đã commit mở lại được; in-flight có thể thiếu usage/evidence. PoC một control process/host worker; chưa distributed execution/fencing tổng quát. Source freshness là quan sát hash/two-pass, không khóa mọi host writer. Proposal/test/runtime gate kiểm binding riêng; cache không cấp quyền, bỏ test hoặc approve/activate.

## Demo riêng

`scripts/prepare_comparison_demo.py ROOT` cần ROOT mới dưới `backend/.local`, PostgreSQL dev và image của test profile đã có. Script tạo database logic, role và network riêng trên cùng PostgreSQL container. Validator baseline lấy từ commit `4924398`, full commit ghi trong manifest. Baseline dùng source đóng riêng. Dev source/grants/target được giữ.

- Control `127.0.0.1:18000`, frontend `127.0.0.1:3100`.
- Target chờ human approval `127.0.0.1:18001`. Baseline chỉ chạy khi cần kiểm, trong một container tự xóa khi thoát. Hai phiên bản đọc cùng dữ liệu báo giá demo. Target sau thay đổi chưa chạy khi chưa duyệt.
- Secrets/process IDs trong root private; `access.json` dùng kết nối thủ công trên host demo. Không đưa token vào URL/export/public docs.
- Từ frontend: `node --experimental-strip-types scripts/browser-smoke.mjs --comparisons`; đặt `CACHESEC_COMPARISON_DEMO_ROOT` nếu root khác. Opt-in này gửi ba source file tới Gemini generation, prompt tới embedding và chạy Docker thật.
- Smoke lưu cold/warm results và `review.md`; chỉ tạo proposal/test và mở history. Human chọn, xem diff/evidence rồi duyệt đúng artifact trước activation.
- Khi target đã active, chỉ đọc lại bằng `CACHESEC_COMPARISON_PAIR_ID` và `--comparisons`; thêm `--comparison-approved` để kiểm app đã duyệt. Không generation lại nhiệm vụ trên project đã có rule.
- History UI liệt kê 100 cặp gần nhất; ID cũ vẫn mở trực tiếp được. Query/score mới do backend tính; dữ liệu cũ thiếu trường giữ unknown.

### Về mốc ban đầu

Trong cột của nhánh cần xem, chọn **Mở đề xuất trong editor → Thay đổi → Đưa mã gốc vào editor**. Nút lấy `base_text` của đề xuất từ snapshot đã lưu. Nếu có nội dung chưa lưu, Workspace hỏi giữ hay bỏ trước khi thay bản nháp. Để ghi lại mã gốc vào project, chọn **Lưu** với phiên có quyền ghi. Lịch sử các bản sửa và bằng chứng test vẫn mở lại được.

Môi trường demo giữ source baseline trong `baseline/` dưới root private. `--comparison-approved` kiểm draft khôi phục, chạy route validation baseline qua ASGI TestClient với PostgreSQL thật trong container tạm, rồi kiểm UI nối app đã duyệt 18001. Cùng ID báo giá thiếu ngày phải trả 0 cờ ở bản gốc và một cờ `expiration_review` ở bản đã duyệt. Probe baseline chạy transaction chỉ đọc, không publish cổng hay cần gateway. Có thể kiểm riêng từ root bằng `backend/.venv/Scripts/python.exe scripts/check_comparison_baseline.py ROOT QUOTATION_ID`.

Lưu mã gốc chỉ thay source. Khi cần phục hồi runtime ngay trên target đang chạy, bản khôi phục phải có kiểm thử phù hợp và phê duyệt triển khai riêng. Profile `expiration-review-v1` đòi rule mới. Để demo hành vi trước thay đổi, dùng probe baseline ở trên.

Prepare không ghi đè/dọn môi trường tồn tại. Manifest giữ tên resource cho owner dọn có scope; không reset app dev làm baseline. Fixture demo kỹ thuật chưa phải fixture nghiên cứu đã đóng băng.
