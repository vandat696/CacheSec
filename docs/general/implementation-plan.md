# Kế hoạch triển khai Proof of Concept

## Trạng thái và nguyên tắc

Lập ngày 2026-11-02; cập nhật tiến độ ngày **2026-11-09**. Trạng thái từng gói T01–T17 nằm ở checklist; dấu chọn chỉ xác nhận đầu ra và kiểm chứng thuộc gói đó. **T02 đã hoàn thành đặc tả thiết kế v0.2**; T01 còn chờ điều kiện nghiên cứu. Đã có nền PostgreSQL/readiness và API báo giá tạo/đọc/phân trang độc lập, quyền Bearer fixture, application/ports và retry idempotent; UI /quotations đã nối API. Đây là lát cắt app T03–T07 và phần UI app T15; chưa hoàn thành toàn bộ gói hoặc chọn thay policy/control còn mở. UI IDE vẫn mô phỏng; chưa có workflow backend/cache/gate hoặc chạy thực nghiệm.

Phạm vi và câu hỏi mở do [tổng quan](overview.md) sở hữu; module/runtime do [kiến trúc](../system/architecture.md) sở hữu, request/response/thao tác do [contract API](../system/api.md) sở hữu; quyền/gate do [phân quyền](../system/authorization.md) sở hữu; protocol/fixture/acceptance do [đánh giá](../evaluation/design.md) sở hữu. Kế hoạch này quản lý việc cần làm và điều kiện nghiệm thu, không thay đặc tả của các tài liệu đó.

Giữ một repo, một fixture cố định, một approval-control implementation và một acceptance rule định trước. Đúng một feature change là flag báo giá thiếu ngày hết hạn hợp lệ. Cache, Agent/tools, gate và trace là hạ tầng chuẩn bị cho cả hai workflow, không phải các feature changes bổ sung trong thí nghiệm. Cache không cấp quyền, bỏ test hoặc thay approval; không tự commit, push hoặc deploy.

Mọi bước lập trình tuân thủ [ba ranh giới ứng dụng/Agent/IDE/cache](../system/architecture.md#quy-tắc-độc-lập-giữa-ứng-dụng-agentide-và-cache). App báo giá có source/entrypoint chạy độc lập; Agent coi source là mục tiêu thao tác qua tools có scope; lõi cache không phụ thuộc nghiệp vụ hoặc host. Runtime app và bản sửa/test tách khỏi process control. Không buộc database hoặc Git repository riêng cho từng thành phần/revision.

Bước T02, T08–T11 và T14 phải giữ [contract tích hợp IDE/Agent](../system/architecture.md#tích-hợp-cachesec-vào-ide-và-agent) chung có phiên bản, được tài liệu hóa. Web Workspace là một host tích hợp. SDK/API và adapter là hình thức có thể chọn, không mặc định scaffold cả hai; MCP/VS Code chưa được chọn làm implementation bắt buộc.

## Cách thực hiện

Thực hiện T01 → T17. Mỗi mục là một gói công việc có đầu ra review được, thường gồm một năng lực hoàn chỉnh và kiểm chứng liên quan; không coi từng bảng DB, endpoint hay component là một tác vụ riêng. Khi bắt đầu một mục, đọc lại code/trạng thái rồi mới chia checklist kỹ thuật chi tiết; không scaffold trước toàn bộ hệ thống.

Theo yêu cầu ngày 2026-11-09, triển khai đến đâu nối giao diện sử dụng được đến đó khi contract/quyền tương ứng đã sẵn sàng. Không đợi hoàn thành toàn bộ backend mới nối UI; phần chưa có backend giữ trạng thái mô phỏng rõ ràng. Điều kiện nghiên cứu/bảo mật còn mở vẫn chặn phần phụ thuộc, không dùng mock thành công để nối luồng.

T01–T04 ưu tiên **thiết kế và xác nhận**. Có thể soạn nháp các mục thiết kế khi còn câu hỏi, nhưng đánh dấu phần chưa chốt và dừng phần triển khai phụ thuộc vào chúng. T05–T16 là phát triển/kiểm chứng kỹ thuật, không được ghi thành kết quả thực nghiệm. T17 mới thu thập dữ liệu so sánh chính khi các điều kiện đã khóa. Khi hoàn thành mục nào, ghi ngắn đầu ra, kiểm tra, giới hạn và bước kế tiếp trong [project status](project-status.md).

Không tự chọn thay người dùng/giảng viên các giá trị ảnh hưởng nghiệp vụ, quyền hoặc tính đúng nghiên cứu. Người dùng đã chọn Context Cache/browser trước, ngày YYYY-MM-DD có thật và không trước mốc fixture 2026-11-07, cùng identity fixture backend quản lý cho PoC. Ngày 2026-11-09 đã xác nhận giữ validation nền hiện tại và parse nghiêm ngặt không trim/ép kiểu/nhận timestamp; oracle/fixture, acceptance, mapping authority/freshness, storage engine/model/sandbox/deploy target còn mở. Tên công việc dưới đây không thay quyết định đã được xác nhận trong overview.

## Danh sách công việc tuần tự

### T01 — Khóa phạm vi và các đầu vào cần xác nhận

- [ ] Hoàn thành T01. **Phụ thuộc:** không có.
- **Trạng thái:** đang thực hiện; [hồ sơ đầu vào T01](overview.md#hồ-sơ-đầu-vào-t01--đang-thực-hiện) đã ghi Context Cache/browser, rule ngày/mốc fixture, bộ sáu trường và identity fixture; ngày 2026-11-09 xác nhận giữ validation nền và parse nghiêm ngặt. Developer có quyền Reviewer được tự duyệt tường minh; acceptance chưa chọn, chờ cô quy định. Fixture/oracle và protocol baseline/số lặp còn mở; chưa đánh dấu hoàn thành T01. Các phần kỹ thuật đã đủ contract được thực hiện theo trạng thái từng gói, không chạy thực nghiệm hoặc triển khai phần phụ thuộc điều kiện còn mở.
- **Làm:** thống nhất schema báo giá tối thiểu, nghĩa ngày hợp lệ/mốc thời gian; vai trò và quyền cần có; chọn lát cắt Answer Cache hoặc Context Cache, vị trí local và host tích hợp đầu tiên. Xác nhận one-fixture contract, oracle, acceptance threshold, công cụ baseline và protocol lặp; phần chưa xác nhận phải có bước bị chặn rõ ràng.
- **Đầu ra:** bảng đã thống nhất/đề xuất/còn mở tại overview; protocol nháp tại evaluation, tách acceptance khỏi similarity threshold.
- **Nghiệm thu:** biết đầu vào, kết quả flag mong đợi và capability được duyệt; không gán quyết định người dùng thành yêu cầu giảng viên đã phê duyệt. Acceptance phải chờ cô quy định, không dùng 100% làm mặc định. T02–T04 có thể soạn nháp, nhưng không triển khai phần phụ thuộc quyết định còn mở.

### T02 — Thiết kế module backend và contract API/cache

- [x] Hoàn thành **đặc tả thiết kế T02 v0.2**. **Phụ thuộc:** các đầu vào kỹ thuật T01 đã chọn; không chốt thay phần nghiên cứu còn chờ.
- **Trạng thái:** [contract v0.2](../system/api.md) có types, quyền, transitions, retry/lỗi và bảng ca đối chiếu; phần API/schema báo giá đã triển khai sau bước thiết kế. Grants/freshness/limits báo giá đã chốt riêng; mapping/integrity, sandbox/activation/deadlines và giới hạn control/cache vẫn còn mở. Dấu chọn xác nhận đầu ra thiết kế, không xác nhận toàn bộ API mục tiêu đã chạy.
- **Làm:** phân ranh source/entrypoint ứng dụng báo giá, control Agent/IDE và lõi cache; định nghĩa luồng request/context/proposal/test/approval/deployment. Đặc tả API theo thao tác, request/response, ID/revision, lỗi, trạng thái bất đồng bộ và cách retry không tạo thao tác trùng. Contract cache không chứa kiểu dữ liệu nghiệp vụ hoặc browser session.
- **Đầu ra:** sơ đồ phụ thuộc/runtime và ranh giới adapter tại architecture; contract dữ liệu/API, ma trận quyền và state transitions tại api.md.
- **Nghiệm thu:** đi được cả đường thành công, reject/error/timeout và nguồn đổi; frontend không tự ghi Approved/ALLOW, Agent không có tool approve/deploy. Contract chưa phải endpoint đang chạy hoặc SDK đã phát hành.

### T03 — Thiết kế database, artifact storage và vòng đời dữ liệu

- [ ] Hoàn thành T03. **Phụ thuộc:** T01–T02.
- **Trạng thái:** gói local v0.1 đã được người dùng chọn để triển khai. Ngoài storage báo giá, đã có [nền blob control](../system/architecture.md#nền-blob-control-đã-triển-khai) với index SQL, publish/register/read nội bộ và encoder metadata; chưa có snapshot/artifact-ready/binding/approval tables. Thiết kế các phần tiếp theo ở [T03 v0.1](../system/architecture.md#đề-xuất-t03-lưu-trữ-control-và-artifact-v01); retention sau nghiên cứu và các phần cache/workflow còn mở, chưa hoàn thành toàn bộ T03.
- **Làm:** lập ERD/data dictionary cho dữ liệu báo giá; identity/scope/repo/snapshot; run/proposal/test/artifact/approval/deployment/events. Xác định chủ sở hữu, khóa/quan hệ, ràng buộc revision/digest, transaction, index, retention và reset. Thiết kế nơi lưu bytes source/artifact tách khỏi metadata; dữ liệu app và control không truy cập chéo bảng nội bộ.
- **Đầu ra:** thiết kế dữ liệu và migration/seed/reset dự kiến trong architecture, phân biệt phương án đã chọn/còn mở. Nếu cache ở browser thì thiết kế storage local và metadata verification tương ứng; chỉ đặc tả bảng/vector phía server theo lựa chọn thực sự cần.
- **Nghiệm thu:** truy vết được proposal → test → artifact → approval → deployment; không cần DB riêng cho mỗi revision. PostgreSQL/pgvector có cấu hình không có nghĩa mọi cache payload phải lưu ở PostgreSQL. T04 phải rà lại schema/contract nếu trust boundary yêu cầu thay đổi; chỉ khóa thiết kế trước T05.

### T04 — Thiết kế quyền, executor, gate và trace

- [ ] Hoàn thành T04. **Phụ thuộc:** T01–T03.
- **Trạng thái:** quyền/freshness API báo giá đã triển khai riêng. [Gói gate local v0.1](../system/authorization.md#phương-án-gate-local-v01-để-chốt) đã được người dùng chọn: authority/TTL/single-use, Docker executor/target, reservation/dispatch/reconciliation và failure boundary. Chưa có control authority/grants/gate/launcher hoặc kiểm chứng host isolation; chưa hoàn tất T04 cho cache/retrieval/delegation. Không dùng quyền app báo giá hoặc blob index làm quyền duyệt/deploy.
- **Làm:** chốt nguồn identity/authority (identity fixture do backend kiểm soát nếu được chọn phải ghi là mô phỏng), repo/path/tool scope, freshness/revoke, offline policy, trusted provenance/integrity; chọn cơ chế cô lập source/test và giới hạn lệnh/tài nguyên/timeout. Đặc tả exact-change approval, artifact bất biến, kiểm tra cùng digest tại activation và mọi đường bypass thuộc PoC. Định nghĩa event/ID/digest/error tối thiểu để instrument ngay từ đầu.
- **Đầu ra:** control/threat boundary và test matrix trong authorization; event schema/nguồn đo trong evaluation; cập nhật contract/schema ở T02–T03 nếu cần.
- **Nghiệm thu:** nêu được cách block chưa duyệt, sai quyền, mã/artifact/evidence đổi sau duyệt, verifier lỗi và source stale; gate không thuộc cache. Process riêng chưa được xem là đủ sandbox. Không chạy Agent hoặc kích hoạt artifact trước khi các điều kiện an toàn phụ thuộc đã được khóa.

### T05 — Nối database và nền lưu trữ backend

- [ ] Hoàn thành T05. **Phụ thuộc:** T02–T04 đã đủ điều kiện triển khai.
- **Trạng thái:** đã có PostgreSQL/metadata retry báo giá và nền blob control với migration 001 riêng, index digest/size, filesystem adapter, PostgreSQL transaction adapter và encoder. Áp dụng local/replay no-op, giữ counts/history báo giá; 216 test backend thật đạt gồm publish/registration song song và lỗi COMMIT thực. Nền storage hoàn thành lát cắt hiện tại; control scope/snapshot/artifact/test/approval/deployment persistence và toàn T04 còn tiếp tục.
- **Làm:** cấu hình kết nối, migration/constraints và adapter lưu trữ cần dùng ngay; kiểm chứng PostgreSQL/extension thực tế nếu được chọn. Tách liveness/readiness, transaction/error handling và cấu hình phiên bản. Chưa xây sẵn bảng, service hoặc dependency cho mọi biến thể mở rộng.
- **Đầu ra:** migration tối thiểu, persistence adapters, hướng dẫn khởi động và reset dữ liệu phát triển trong phạm vi rõ ràng.
- **Nghiệm thu:** migrate/read/write và lỗi kết nối được kiểm tra trên DB thật; migration rollback/forward hoặc khôi phục theo cách đã thiết kế. Không giả readiness thành công khi DB lỗi; không tự xóa volume/dữ liệu ngoài test được cho phép.

### T06 — Thực thi identity, scope và trace nền

- [ ] Hoàn thành T06. **Phụ thuộc:** T04–T05.
- **Trạng thái:** API báo giá có registry fixture, kiểm capability hiện tại trước thao tác/replay và request ID backend. Đã test deny/giả header/thu hồi/authority lỗi; hai identity đọc cùng dataset app, chưa có phân vùng tenant/repo, authority reviewer/control hoặc event persistence/audit nghiên cứu.
- **Làm:** middleware/dependency lấy identity đáng tin cậy, kiểm tra tenant/repo/action; lưu policy/config versions và tạo request/run/event IDs. Bổ sung thời gian thực tế, outcome/reason, lỗi/timeout và redaction cho các thao tác đã có; mỗi năng lực sau phải mở rộng trace của chính nó.
- **Đầu ra:** authorization service nhỏ, bộ kiểm tra scope và event persistence theo contract; không tạo policy engine tổng quát.
- **Nghiệm thu:** giả tenant/role/scope, thiếu quyền và authority unavailable bị chặn; trace success/deny/error không lộ secrets. Chưa có nghiệp vụ không được sinh event cache/test/deploy giả.

### T07 — Dựng ứng dụng báo giá nền và fixture duy nhất

- [ ] Hoàn thành T07. **Phụ thuộc:** T01, T05–T06 và contract app ở T02.
- **Trạng thái:** đã có domain/application/storage và entrypoint API tạo/đọc/phân trang/validate nền độc lập control/Agent/cache; UI /quotations gọi HTTP/PostgreSQL thật. validate_quotation là điểm vào source cho nhiệm vụ sửa code; baseline chưa có quy tắc nghiệp vụ, công bố flags/evaluated_rules rỗng thay vì giả ngày hợp lệ. Operator cần cả read/validate, không ghi DB hoặc tạo evidence/approval. API/UI và lỗi quyền/response đến trễ đã kiểm chứng; [project status](project-status.md) ghi kết quả test mới nhất. [Bảng oracle T07](../evaluation/design.md#bảng-oracle-t07-để-review) vẫn cần review nhãn và one-fixture contract. Chưa có rule ngày, reference-date/artifact từ launcher, manifest đóng băng hoặc revision gốc nghiên cứu; chưa hoàn thành T07.
- **Làm:** app tiếp nhận/danh sách/chi tiết/validation tối thiểu chạy độc lập, **chưa có rule mới**. Tạo một fixture manifest có nhãn, mốc thời gian, phần ca gate/reuse liên kết và oracle theo contract đã xác nhận; backend đọc schema dùng chung, không import script nghiên cứu.
- **Đầu ra:** source app nền, entrypoint/API riêng với control, test nền và manifest có version/digest; ghi revision gốc và cách tái tạo trạng thái ban đầu.
- **Nghiệm thu:** app chạy không import code Agent/IDE/cache; test hành vi cũ pass. Ca kiểm tra rule mới chứng minh thiếu sót có chủ đích, phân biệt expected failure của app gốc với lỗi của workflow đã hoàn thành. Fixture UI cũ không trở thành fixture thực nghiệm; các test double đơn vị không phải tập benchmark thứ hai.

### T08 — Đọc repository được phép và theo dõi provenance

- [ ] Hoàn thành T08. **Phụ thuộc:** T02, T04, T06–T07.
- **Làm:** repository adapter đọc source mục tiêu theo repo/path/snapshot; lấy file/symbol/context cần thiết, dependency manifest và hash từ nguồn tin cậy. Xác định snapshot khi working tree chưa commit và cách phát hiện file đổi; chỉ thêm index/RAG cần cho lát cắt.
- **Đầu ra:** authorized retrieval có provenance, không phụ thuộc trực tiếp vào model nghiệp vụ báo giá.
- **Nghiệm thu:** tìm đúng validation; deny repo/path ngoài scope, traversal/symlink và secrets theo policy. Mọi dependency cần có bằng chứng; source thay đổi phải phát hiện trước reuse hoặc sửa code. Code control/cache/gate không nằm trong scope Agent được sửa.

### T09 — Nối LLM và embedding qua adapter riêng

- [ ] Hoàn thành T09. **Phụ thuộc:** T01–T02, T06 và T08.
- **Làm:** chọn provider/model/config đã xác nhận, tách generation khỏi embedding; chuẩn hóa usage, timeout, retry, lỗi và provenance đầu vào. Chỉ kết nối embedding khi lát cắt cần; không thêm nhiều provider hoặc SDK ngoài nhu cầu.
- **Đầu ra:** đường hỏi hiểu repo No Cache chạy thật, usage/duration có trace; vector namespace/config khi có embedding.
- **Nghiệm thu:** provider lỗi/thiếu usage được báo đúng; không fallback sang câu mẫu giả thành công. Test double có nhãn riêng; có kiểm chứng kết nối thật được phép, không phải số đo benchmark. Chưa giao Agent tạo rule mới ở bước này.

### T10 — Cache exact, admission và verification

- [ ] Hoàn thành T10. **Phụ thuộc:** T01–T04, T06, T08–T09.
- **Làm:** triển khai lát cắt cache đã chọn với storage adapter, contract có phiên bản, exact lookup, admission và verifier. Ràng buộc identity/tenant/repo/intent/scope, mọi dependency/version/hash, policy/config/TTL và toàn vẹn payload; Miss/Rejected fallback vào authorized retrieval/model.
- **Đầu ra:** Hit/Miss/Rejected và Error/Timeout thật; lõi cache tách nghiệp vụ/host, cache payload và dữ liệu approval tách biệt.
- **Nghiệm thu:** hit hợp lệ đúng payload; sai scope/tenant/quyền/nguồn, TTL, integrity hoặc verifier unavailable không trả payload. No Cache bỏ lookup/reuse nhưng giữ authorization. Với Answer Cache có thể tránh sinh answer; với Context Cache vẫn có thể gọi LLM, không tự báo tiết kiệm calls/tokens.

### T11 — Semantic matching và lifecycle cache

- [ ] Hoàn thành T11. **Phụ thuộc:** T10 và quyết định embedding/similarity/TTL/eviction/invalidation.
- **Làm:** semantic candidate matching dùng đúng model/revision/dimension/metric/namespace, verifier dùng chung với exact; thêm capacity/eviction tối thiểu và invalidation khi source/quyền/policy/config đổi. Khóa similarity threshold theo protocol, không chọn bằng nhãn evaluation.
- **Đầu ra:** candidate/terminal trace, lifecycle và overhead thực; phân vùng hiệu chỉnh/đánh giá trong cùng manifest nếu đã được thống nhất.
- **Nghiệm thu:** paraphrase tương đương có thể hit; gần nghĩa nhưng sai intent hoặc stale/unauthorized phải reject. Đổi embedding phải re-embed hoặc namespace khác; bỏ lỡ invalidation vẫn bị verifier chặn. Có chi phí lookup/embedding/network/verification; chưa suy ra lợi ích workflow từ probe có chủ đích.

### T12 — Quản lý bản sửa và chạy test tách biệt

- [ ] Hoàn thành T12. **Phụ thuộc:** T02–T08 và cơ chế executor đã chốt tại T04.
- **Làm:** tạo bản làm việc riêng từ đúng source snapshot; áp patch trong scope, sinh diff thật và proposal revision; chạy allowlist test/build có timeout/giới hạn trong môi trường tách khỏi control. Tạo artifact bất biến và test evidence gắn artifact/fixture/config hashes.
- **Đầu ra:** executor và artifact/evidence store dùng chung cho Developer-guided và AI-assisted, API trạng thái/lỗi có trace.
- **Nghiệm thu:** path ngoài app, patch không khớp base, lệnh không được phép và timeout bị chặn/báo đúng. Sửa code không đổi runtime đang dùng; code hiển thị lấy từ snapshot thật. Chỉ kiểm tra hạ tầng bằng ca kiểm soát phù hợp, không bổ sung sẵn rule mới vào baseline để thay phần việc của Agent.

### T13 — Approval gate và kích hoạt đúng artifact

- [ ] Hoàn thành T13. **Phụ thuộc:** T04–T07 và T12.
- **Làm:** lưu quyết định tường minh từ reviewer có authority; gate kiểm tra source/patch/artifact/test/fixture/config binding và hiệu lực tại activation. Kích hoạt đúng artifact đã duyệt cho runtime app tách biệt; ghi deployed/blocked/failed, không rebuild bytes khác sau duyệt.
- **Đầu ra:** một approval/deployment control chung cho cả hai workflow, kiểm tra qua API/control trực tiếp.
- **Nghiệm thu:** chưa duyệt, sai quyền, sai artifact/evidence, đổi code sau duyệt hoặc approval hết hiệu lực bị block; chỉ artifact hợp lệ được kích hoạt. Không có đường UI/API/tool thuộc threat boundary bỏ qua gate; cache hit/test pass không cấp quyền. **Chưa deployment nào của rule mới được phép trước mục này.**

### T14 — Agent tạo đúng một thay đổi và hoàn tất luồng thật

- [ ] Hoàn thành T14. **Phụ thuộc:** T08–T13.
- **Làm:** nối request → context/cache → model/Agent tools → proposal/diff → test → xin duyệt → activation qua control. Chỉ giao một thay đổi flag ngày hết hạn; Agent không có quyền approve/deploy hoặc sửa control/cache/policy.
- **Đầu ra:** workflow dùng prompt thật tạo bản sửa source thật trong snapshot riêng; hành vi báo giá đổi sau đúng quyết định của reviewer. Các thao tác approve/activate được thực hiện bởi actor/control có quyền, không do Agent tự quyết.
- **Nghiệm thu:** flags của artifact đúng oracle, regression pass; diff/test/approval/deploy trỏ cùng artifact. Yêu cầu ngoài scope, nguồn đổi, model/tool lỗi, thiếu duyệt hoặc revision stale có trace và không kích hoạt sai. Chạy kiểm chứng kỹ thuật, chưa thu thập số liệu so sánh chính.

### T15 — Nối giao diện IDE và màn báo giá với backend

- [ ] Hoàn thành T15. **Phụ thuộc:** API ở T07 và workflow T14.
- **Trạng thái:** đã nối phần app báo giá: form/danh sách/chi tiết qua API, token fixture trong bộ nhớ, lỗi/quyền/retry thật, liên kết từ Workspace. IDE code/Agent/review/test/deploy còn mô phỏng; T15 chưa hoàn thành toàn bộ.
- **Làm:** tái sử dụng code/chat IDE, thay fixture bằng source/diff/message/status thật; nối hộp thoại test/approval. Thêm màn báo giá tối giản dùng API app để nhập/xem/validation và quan sát trước/sau activation; route cụ thể theo contract đã chốt, không dựng ERP hoặc IDE đầy đủ.
- **Đầu ra:** demo sử dụng được từ trình duyệt: prompt → diff/test → reviewer duyệt → kích hoạt → báo giá phản ánh rule mới.
- **Nghiệm thu:** UI không tự bịa hit/test/approval; loading/error/reconnect và stale revision rõ; thao tác chưa được phép không thành công qua API. Code/chat vẫn là hai vùng chính, giữ UI ít chữ, accessibility/responsive và các màn cũ.

### T16 — Hoàn thiện runner, reset và nghiệm thu hệ thống

- [ ] Hoàn thành T16. **Phụ thuộc:** T05–T15 và protocol đã xác nhận.
- **Làm:** runner/API/CLI điều phối hai workflow, ghi nhận phần thao tác người thật của Developer-guided thay vì tự động thay bằng Agent; reset app/source/proposal/approval/deployed/cache state trong vùng cho phép. Lưu run manifest, phiên bản, event links, usage và export JSON/CSV; kiểm tra end-to-end cả success/blocked/error/timeout và khả năng tái tạo từ môi trường sạch.
- **Đầu ra:** hướng dẫn chạy, runner và báo cáo nghiệm thu kỹ thuật; một fixture/gate/config được khóa trước T17. Nếu fixture/source đổi thì bump version/digest và chạy lại kiểm tra phụ thuộc.
- **Nghiệm thu:** không rò state/approval giữa lượt; có planned/attempted/completed và phát hiện thiếu trace. Lint/typecheck/test/build/browser/backend/DB phù hợp đạt hoặc nêu blocker; không gọi demo song song là benchmark và không ghi test kỹ thuật thành kết quả nghiên cứu.

### T17 — Chạy so sánh chính và lập báo cáo

- [ ] Hoàn thành T17. **Phụ thuộc:** T01–T16 đạt; repo/fixture/gate/acceptance/protocol và số lặp được xác nhận, khóa trước run.
- **Làm:** thực hiện Developer-guided / AI-assisted trên cùng trạng thái ban đầu và điều kiện đã định; đo correctness, approval gate, reproducibility, trace completeness, engineering time/failures. Tính cả chuẩn bị theo protocol, errors/timeouts và can thiệp thủ công.
- **Đầu ra:** artifacts/manifest/báo cáo có nguồn đo và mẫu số, phân biệt quan sát thực, mock/probe và cost estimate.
- **Nghiệm thu:** mọi run lên lịch được ghi nhận, không chọn lại threshold sau kết quả hoặc chỉ giữ run thành công. Không gán riêng chênh lệch hai workflow cho cache; không có reuse hữu ích phải báo đúng. Chưa đạt điều kiện đầu vào thì chưa chạy thực nghiệm.

## Mở rộng sau PoC — chưa cam kết triển khai

| ID | Việc | Điều kiện và kết quả cần có |
| --- | --- | --- |
| X01 | So sánh riêng AI Cache/No Cache | Chỉ khi phép thử phụ được thống nhất, sau T16–T17; giữ cùng Agent/model/retrieval/quyền/gate, tách cold/warm/preload và probe khỏi workflow tự nhiên. Báo latency/calls/tokens/verification thật, kể cả không có lợi ích |
| X02 | Adapter cho IDE/Agent bên ngoài, ví dụ MCP hoặc VS Code | Sau contract/cache thật và PoC cốt lõi; chọn một tổ hợp host/Agent/adapter cụ thể trước. Kiểm chứng quyền, provenance, stale/reject/error và tích hợp thật trước công bố tương thích; không mặc định phải viết extension mới hoặc chọn MCP |
| X03 | Biến thể cache/model/policy | Answer/Context bổ sung ngoài lát cắt đã chọn, server cache, exact/semantic variants, eviction/policy sweeps, nhiều provider hoặc fine-tune/FL chỉ khi có câu hỏi nghiên cứu và protocol riêng được thống nhất; giữ trong thiết kế, chưa thêm dependency/runner cho tất cả |

## Bước tiếp theo ngay lúc này

Gói local v0.1 đã được chọn, nền blob/control migration đã triển khai và kiểm chứng. Tiếp theo nối registry authority/scope/repo và snapshot refs vào storage, rồi artifact/harness và launcher/gate theo dependency; không expose blob qua hash khi chưa có quyền resource. App báo giá giữ validator nền chưa có rule expiration_review. T07 vẫn cần review oracle/one-fixture contract; R/config và artifact phải được runtime tin cậy cấp trước đóng băng source gốc/fixture nghiên cứu. Acceptance/protocol nghiên cứu chưa khóa, không bắt đầu run so sánh. Chi tiết trạng thái ở project-status; câu hỏi còn mở ở [overview](overview.md#giả-định-và-câu-hỏi-mở).

| Trước bước phụ thuộc | Cần khóa |
| --- | --- |
| T07 và nhãn fixture | Review bảng oracle theo schema/validation nền và parse đã xác nhận, chốt one-fixture contract; kiểm chứng tích hợp mới đã đạt |
| T05–T06, T08 và T12–T13 | Data/API contract, identity/authority, freshness, source integrity, executor/sandbox, artifact binding và deploy target liên quan |
| T09–T11 | Đã chọn Context Cache/browser cho web đầu tiên; còn model/embedding, storage engine, similarity threshold, TTL/invalidation và phạm vi chia sẻ |
| T16–T17 | Acceptance rule, baseline tools, số lặp/thứ tự, reset/preload, nguồn đo và expected trace; không điều chỉnh theo kết quả |

Đường dẫn implementation hiện tại ở [bản đồ source](../system/code-organization.md); backend/app/quotation_demo đã có thật. Giữ định danh/path hiện có trừ khi thay đổi có lý do thiết kế; không đổi package/repository chỉ để đổi bối cảnh. research/datasets/quotation_fixture_v1.json vẫn là ví dụ chưa tạo, không phải fixture nghiên cứu đã chốt.

UI Thiết lập cũ còn manifest tài liệu nội bộ và TTL/threshold/training intent nháp; không dùng chúng làm thông số PoC mặc định. Backend không import script nghiên cứu. Không tự commit, push, xóa dữ liệu hoặc kích hoạt/deploy ra môi trường ngoài phạm vi đã được yêu cầu.
