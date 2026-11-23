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
| `POST /comparisons` | Idempotency-Key, snapshot/prompt, cold/warm/preload và consent tường minh. `model` tùy chọn. Gửi `session_id` của phiên đang mở để thêm lượt, bỏ trường này để tạo phiên mới |
| `POST /comparisons/{id}/{mode}` | Transaction chuyển ready → starting trước consume; retry trả trạng thái, không enqueue lại |
| `GET /comparisons` | 100 phiên cập nhật gần nhất của người tạo còn quyền repository/workflow. Mỗi phiên dùng câu hỏi đầu làm tiêu đề và mở lượt gần nhất |
| `GET /comparisons/{session_id}/turns` | Các lượt theo thứ tự gửi, gồm câu hỏi và câu trả lời/trạng thái của hai nhánh |
| `GET /comparisons/{id}` | Tải kết quả, test và evidence của đúng lượt đã lưu |
| `POST /comparisons/{id}/{mode}/cancel` | Dừng controller; job đã dispatch có thể còn chạy, giữ reference để kiểm tra |
| `POST /comparisons/{id}/cache-io` | Lưu client-reported write state/timing, gắn đúng admission entry; không thay verifier outcome |

Backend chọn adapter theo ID được phép. Model nằm trong fingerprint của cặp và namespace của context. Khi start nhánh, backend lấy model từ cặp đã lưu, đối chiếu với request context và dùng model đó cho mỗi lượt sửa/test. Entry của model khác bị verifier loại. Lượt standalone context dùng model mặc định. `POST /messages` và `POST /runs` của Agent cũng nhận `model` tùy chọn. URL, key và quyền do backend quản lý.

Standalone context POST chưa có key registry riêng, không tự retry generation. So sánh có resource/key bền riêng.

Browser resolve candidate trước khi chạy hai nhánh. None không mở IndexedDB/lookup/embedding/admission Local. Miss/Rejected fallback bằng retrieval có quyền; authority/verifier/storage backend lỗi trả lỗi. IndexedDB lỗi ghi riêng `client_storage_error`; lỗi embedding ghi cho Local, None vẫn có thể chạy. Không đổi lỗi thành Hit/Miss thành công.

Workspace đưa **Không cache** vào hàng đợi trước **Có Context Cache**. Control dùng một worker so sánh. Nhánh thứ hai chờ controller của nhánh trước kết thúc, kể cả lần thử lại model và test trong vòng thực thi. Mỗi nhánh bắt đầu tính giới hạn mười phút khi worker nhận chạy.

Workspace mở sẵn editor mã nguồn cạnh chat **Cả hai**. Hai tab **Không cache** và **Có Context Cache** hiển thị toàn bộ câu hỏi theo thứ tự gửi, kèm phản hồi của nhánh tương ứng. Nút đồng hồ mở lại phiên. **Phiên mới** làm trống chat và đưa hai nhánh về **Chưa chạy**. Mỗi câu gửi tiếp trong cùng phiên tạo một cặp chạy riêng trên snapshot của lượt đó. Các lượt lưu trước khi có định danh phiên được mở như những phiên riêng.

Khi tạo lượt mới, backend chốt tối đa sáu lượt đã kết thúc gần đây của chính phiên, trong ngân sách 24.000 byte UTF-8 cho hội thoại. Hai nhánh nhận cùng lịch sử. Khi có đề xuất đã qua test trên đúng snapshot gốc, cả hai nhận thêm diff của đề xuất đó làm ngữ cảnh, tối đa 8 KiB mỗi diff. Chỉ dẫn Agent dùng diff khi câu mới yêu cầu tiếp tục bản đề xuất và hỏi lại nếu cách chọn bản sẽ làm thay đổi đáng kể kết quả. Registry lưu ID lượt, digest lịch sử và tham chiếu revision để kiểm lại trước khi gửi. Embedding vẫn dùng prompt mới.

Cuộn xuống dưới Workspace để xem hai bản sửa, tiến trình, cache hit/miss, lỗi và số liệu của lượt đang mở. Nền xanh `+` là dòng thêm, nền đỏ `−` là dòng xóa. **Đến dòng sửa** cuộn tới thay đổi đầu tiên trong khung đó. Trên màn hình hẹp, hai bản xếp dọc. Bấm **Mở đề xuất trong editor** khi cần chỉnh tiếp.

### Chọn bản để chạy app Báo giá

Ở cột Không cache hoặc Có Context Cache, chọn **Chọn bản chạy** trên revision mới nhất đã test đạt. Vùng **Bản chạy** bên dưới ghi rõ nhánh/revision. Chọn **Chạy ứng dụng**, xem tên nhánh, diff và artifact rồi **Phê duyệt và chạy bản này**. Chọn nhánh chỉ giữ lựa chọn UI, không ghi source editor hoặc tạo approval. Nếu cần ghi candidate vào project để sửa tiếp, vẫn dùng **Mở đề xuất trong editor → Lưu**.

Hai nhánh dùng chung gate backend hiện có. Test phải khớp proposal/revision/artifact/profile và có evidence; retry approval/activation giữ binding riêng, kể cả hai nhánh có artifact giống nhau. Không đổi nhánh trong lúc review/activation đang xử lý. Backend tiếp tục kiểm quyền, source freshness, revision hiện tại, evidence và target trước approve/dispatch; lịch sử stale có thể bị chặn. Chỉ bản đã duyệt được activate; không chạy hai phiên bản app cùng lúc, cache không cấp quyền triển khai.

## Lịch sử và số đo

Migration 006 thêm requests/registry; 007 thêm pairs, immutable revision references và append-only assessments. Source/diff/artifact/evidence dùng snapshot/blob hiện có; registry cache không lưu payload. Checkpoint lưu events/usage/trạng thái từng mốc, không lưu credential.

Technical assessment gắn artifact/evidence và `technical-trace-v1`; các tiêu chí nghiên cứu chưa khóa/chưa thực hiện ghi null kèm lý do. Test kỹ thuật pass không phải acceptance hoặc phê duyệt triển khai.

- Tokens lấy response provider từng lượt; thiếu usage là null. Không suy số calls/tokens tiết kiệm từ Hit.
- Mỗi nhánh có cùng [ngân sách thử lại model](agent-workflow.md#vòng-thực-thi). **Chi tiết** hiển thị trạng thái HTTP của lỗi provider khi có và số lần controller thử gọi. Lượt đã có response thành công được đếm riêng. `started` ghi lúc controller bắt đầu bước sinh mã, trước kiểm tra nguồn cuối cùng và gửi HTTP.
- `generation_ms`: adapter generation; `embedding_ms`: gồm HTTP embedding; `preparation_ms`: authority/source/embedding trước ghi request.
- `resolution_ms`: verify/retrieval trước commit; `server_workflow_ms`: từ start nhánh tới checkpoint terminal, trừ thời gian trong hàng đợi worker. Số đo chưa gồm delivery HTTP/commit cuối.
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
- URL chứa ID lượt cũ vẫn mở trực tiếp được. Query/score mới do backend tính; dữ liệu cũ thiếu trường giữ unknown.

### Về mốc ban đầu

Trong cột của nhánh cần xem, chọn **Mở đề xuất trong editor → Thay đổi → Đưa mã gốc vào editor**. Nút lấy `base_text` của đề xuất từ snapshot đã lưu. Nếu có nội dung chưa lưu, Workspace hỏi giữ hay bỏ trước khi thay bản nháp. Để ghi lại mã gốc vào project, chọn **Lưu** với phiên có quyền ghi. Lịch sử các bản sửa và bằng chứng test vẫn mở lại được.

Môi trường demo giữ source baseline trong `baseline/` dưới root private. `--comparison-approved` kiểm draft khôi phục, chạy route validation baseline qua ASGI TestClient với PostgreSQL thật trong container tạm, rồi kiểm UI nối app đã duyệt 18001. Cùng ID báo giá thiếu ngày phải trả 0 cờ ở bản gốc và một cờ `expiration_review` ở bản đã duyệt. Probe baseline chạy transaction chỉ đọc, không publish cổng hay cần gateway. Có thể kiểm riêng từ root bằng `backend/.venv/Scripts/python.exe scripts/check_comparison_baseline.py ROOT QUOTATION_ID`.

Lưu mã gốc chỉ thay source. Khi cần phục hồi runtime ngay trên target đang chạy, bản khôi phục phải có kiểm thử phù hợp và phê duyệt triển khai riêng. Profile `expiration-review-v1` đòi rule mới. Để demo hành vi trước thay đổi, dùng probe baseline ở trên.

Prepare không ghi đè/dọn môi trường tồn tại. Manifest giữ tên resource cho owner dọn có scope; không reset app dev làm baseline. Fixture demo kỹ thuật chưa phải fixture nghiên cứu đã đóng băng.
