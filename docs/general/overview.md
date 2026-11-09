# Tổng quan, yêu cầu và phạm vi nghiên cứu

## Định hướng hiện hành — 2026-11-02

**CacheSec** nghiên cứu **Secure Local Semantic Cache for AI-Assisted Software Development**: tái sử dụng thông tin AI đã xử lý khi còn đúng, đúng quyền và còn hiệu lực. AI Coding Agent hỗ trợ Developer là bối cảnh ứng dụng; kiến trúc cache vẫn là đóng góp nghiên cứu. Bối cảnh chatbot hỏi đáp tài liệu nội bộ trước đây được thay bằng tìm hiểu và thay đổi code repository trong một quy trình có kiểm soát. Code giao diện cũ được giữ để tái sử dụng, chưa chuyển đổi trong đợt cập nhật tài liệu này.

Tài liệu này sở hữu problem statement, yêu cầu, giả định và câu hỏi mở. [Project status](project-status.md) ghi hiện trạng có bằng chứng; [kiến trúc](../system/architecture.md) là thiết kế mục tiêu; [đánh giá](../evaluation/design.md) phân biệt yêu cầu giảng viên với đề xuất phương pháp; [kế hoạch](implementation-plan.md) là công việc chưa thực hiện.

## Bài toán và mục tiêu

Developer cần tìm vị trí validation, hiểu code/nguồn liên quan, đề xuất patch và kiểm thử. Các câu hỏi hoặc ngữ cảnh tương đương có thể khiến việc truy xuất và gọi LLM bị lặp lại. CacheSec nghiên cứu khi nào có thể reuse an toàn để giảm thời gian, lượt gọi và token, tính cả chi phí embedding, xác minh quyền và mạng. Một tác vụ không có reuse thực tế có thể không hưởng lợi; không giả định cache luôn nhanh hơn.

Mục tiêu là xác minh reuse đúng ngữ nghĩa và phiên bản; bảo toàn quyền hiện tại; hỗ trợ hoàn thành một thay đổi phần mềm; giữ approval gate độc lập; và đo kết quả có thể tái lập. Similarity cao không chứng minh tương đương đáp án, quyền hay tính đúng của code.

## Yêu cầu trực tiếp từ giảng viên

Nguồn: nội dung yêu cầu người dùng cung cấp ngày 2026-11-02, chưa có tài liệu giảng viên riêng trong repo.

| Ràng buộc | Nội dung phải giữ |
| --- | --- |
| Workflow | Intake and validation of supplier quotations trong hàng đợi mua sắm doanh nghiệp giả lập |
| Đúng một thay đổi | Thêm quy tắc đánh dấu báo giá đầu vào thiếu ngày hết hạn hợp lệ để con người xem xét |
| Đúng một safety property | Không triển khai bất kỳ thay đổi quy tắc validation nào nếu chưa có người có thẩm quyền phê duyệt tường minh chính xác thay đổi đó |
| So sánh chính | Developer-guided baseline và AI-assisted workflow trên cùng tập báo giá ẩn danh hoặc giả lập đã đóng băng |
| Năm chiều đo | Correctness of flags; preservation of approval gate; reproducibility; completeness of change/decision trace; engineering time và observed failure cases |
| Giới hạn thực nghiệm | Một repository; một test fixture; một approval-control implementation; một acceptance threshold định trước |

Giá trị acceptance threshold chưa được giảng viên quy định. Các giá trị, schema, thuật toán và bố cục đề xuất trong docs không phải xác nhận của giảng viên.

## Use case duy nhất

Ứng dụng báo giá mẫu trong cùng repository đã tiếp nhận, lưu và đọc báo giá giả lập qua API/PostgreSQL và UI /quotations; chưa có runtime validation ngày. Trạng thái gốc chuẩn bị cho thí nghiệm phải chưa có quy tắc ngày hết hạn mới. Developer yêu cầu Agent tìm validation và thêm cờ human review cho báo giá thiếu ngày hợp lệ; contract mục tiêu dùng cờ expiration_review. Cờ không tự từ chối báo giá, không phê duyệt mua hàng và không mở rộng sang quy tắc nghiệp vụ khác.

CacheSec dự kiến cung cấp workspace, authorized repository retrieval, đề xuất diff, chạy test, duyệt thay đổi và trace. Reviewer duyệt **thay đổi code/artifact**, không duyệt báo giá. Deploy trong PoC được đề xuất là kích hoạt artifact trong môi trường giả lập có gate thật; mức fidelity và ranh giới kiểm soát cần thống nhất trước triển khai, không gọi một nút UI mô phỏng là deployment control.

## Yêu cầu chức năng mục tiêu

| ID | Yêu cầu | Bằng chứng cần có khi triển khai |
| --- | --- | --- |
| FR-01 | App báo giá tối giản và trạng thái gốc không có rule mới | Code và test hiện trạng chạy được, revision gốc được ghi |
| FR-02 | Một fixture có nhãn, định nghĩa ngày hợp lệ và thời điểm tham chiếu cố định | Manifest/hash bất biến, ca biên và oracle được duyệt trước thực nghiệm |
| FR-03 | Repository Context Cache trong trình duyệt cho web Workspace, embedding, exact/semantic matching và threshold | Hit/Miss/Rejected thật, context/provenance được backend xác minh trước khi Agent dùng; LLM vẫn xử lý, không gán hit hoặc tiết kiệm từ mô phỏng |
| FR-04 | Authorization và cache verification trước reuse | Identity/tenant/repo, scope/intent, nguồn/version/hash, TTL, policy và toàn vẹn; lỗi thì không reuse |
| FR-05 | Authorized Repository Retrieval/RAG khi miss/reject | Chỉ đọc nguồn được phép, có provenance; lỗi quyền không biến thành truy xuất không hạn chế |
| FR-06 | Agent tạo patch đúng một rule và chạy kiểm thử thật | Diff, revision, kết quả validation/gate và lỗi có liên kết |
| FR-07 | Một approval gate chung cho cả hai workflow | Chặn chưa duyệt/sai quyền/sai phiên bản; chỉ deploy đúng artifact được duyệt, backend/control thực thi |
| FR-08 | Trace và evaluation | Truy ngược request → context/cache → patch → test → approval → deployment; ghi năm chiều đo và chỉ số cache riêng |
| FR-09 | Admission, TTL, eviction, invalidation và cấu hình có phiên bản | Namespace riêng cho cấu hình/vector; nguồn/policy đổi phải kiểm tra lại; không cache quyết định deployment approval |

Ngày 2026-11-07, người dùng chọn **Repository Context Cache trong trình duyệt cho web Workspace trước**, adapter IDE làm sau. Quyết định này thay đề xuất Answer Cache đầu tiên; không phải yêu cầu mới đã được giảng viên xác nhận hoặc tính năng đã triển khai. [Thiết kế cache](../system/cache.md) sở hữu payload và verification. Answer Cache, server cache, nhiều embedding/eviction, hai tầng và fine-tune/FL vẫn là khả năng mở rộng ngoài lát cắt đã chọn.

## Yêu cầu phi chức năng

| ID | Yêu cầu |
| --- | --- |
| NFR-01 | Không tin quyền/metadata client tự khai; fail closed khi không xác minh được; nêu rõ freshness và giới hạn local plaintext |
| NFR-02 | Khóa repo gốc, fixture, gate implementation, acceptance rule và cấu hình đo trước run; lưu phiên bản và mọi lỗi/timeout |
| NFR-03 | Đo end-to-end và thành phần thực tế, không dùng độ trễ demo hoặc usage 0 để kết luận tiết kiệm |
| NFR-04 | Dữ liệu giả lập, log tối thiểu đủ audit, không ghi secrets hoặc code ngoài scope được cấp quyền |
| NFR-05 | Theo cấu trúc Next.js/TypeScript, FastAPI/Python hiện có; tách nghiệp vụ khỏi UI/storage và adapter khỏi provider; không dựng ERP/microservice/plugin framework |
| NFR-06 | Theo yêu cầu người dùng ngày 2026-11-07, tách source ứng dụng báo giá, Agent/IDE và lõi cache trong cùng repo; app chạy độc lập. Cache có contract chung có phiên bản, được tài liệu hóa, có thể cung cấp bằng SDK/API và adapter để dùng trực tiếp trong IDE/Agent được hỗ trợ, không buộc dùng web Workspace. [Kiến trúc](../system/architecture.md#quy-tắc-độc-lập-giữa-ứng-dụng-agentide-và-cache) sở hữu ranh giới; hỗ trợ nhiều IDE là hướng mở rộng, chưa có implementation hoặc bằng chứng tích hợp ngoài |

Safety property bắt buộc là **một** thuộc tính về deployment approval. Các điều kiện cache, quyền nguồn và chất lượng là yêu cầu bảo đảm reuse/đánh giá kiến trúc, không đổi thành nhiều bài toán nghiệp vụ hoặc nhiều software changes.

## Hồ sơ đầu vào T01 — đang thực hiện

Đã bắt đầu T01 ngày 2026-11-07. T01 chưa hoàn thành; phân biệt quyết định người dùng, yêu cầu giảng viên và bản nháp cần review. Các chi tiết chưa chốt tiếp tục nằm trong [câu hỏi mở](#giả-định-và-câu-hỏi-mở), không được dùng làm oracle/schema đã khóa.

| Đầu vào | Trạng thái được xác nhận |
| --- | --- |
| Loại cache đầu tiên | Người dùng chọn Context Cache: tái sử dụng ngữ cảnh repo; LLM vẫn xử lý yêu cầu |
| Vị trí/host đầu tiên | Người dùng chọn cache trong trình duyệt cho web Workspace trước; adapter IDE làm sau. Storage engine/API cụ thể chưa chốt |
| Ngày hết hạn | Người dùng chọn ngày có thật theo lịch, định dạng YYYY-MM-DD và không trước mốc tham chiếu. Fixture dùng mốc cố định 2026-11-07; ngày bằng mốc được chấp nhận |
| Nguồn danh tính PoC | Người dùng chọn danh tính giả lập do backend quản lý, công bố rõ giới hạn; approval gate vẫn phải thực thi thật. Mapping principal/quyền và freshness cần chốt ở phần control |
| Quyền API báo giá | Hai principal fixture: chỉ đọc; tạo và đọc. Bearer token ngẫu nhiên cấu hình riêng, thiếu/sai token bị chặn, không tài khoản mặc định. Tách quyền Reviewer/deployment; [chi tiết](../system/authorization.md#quyền-api-báo-giá-đã-triển-khai) |
| Freshness API báo giá | Kiểm token/quyền ở đầu mỗi thao tác; thu hồi chặn thao tác tiếp theo, không hủy thao tác đang thực hiện hoặc thu lại nội dung đã đọc. Không chốt thay cache/control/gate |
| Giới hạn API local | Body JSON tối đa 64 KiB, trang tối đa 100 báo giá, Idempotency-Key 1–128 ký tự ASCII. Đây là cấu hình kỹ thuật, không phải ngưỡng nghiệm thu nghiên cứu |
| Người duyệt thay đổi | Developer được tự duyệt nếu có quyền Reviewer hiện tại; vẫn cần quyết định tường minh gắn đúng artifact. Agent không nhận quyền phê duyệt |
| Phạm vi dữ liệu báo giá | Người dùng chốt 6 trường: mã, nhà cung cấp, mô tả, tổng tiền, tiền tệ và ngày hết hạn; kiểu dữ liệu/validation nền và contract API chi tiết thuộc T02–T03 |
| Validation nền — xác nhận 2026-11-09 | Giữ contract đã triển khai: bốn trường ngoài ngày bắt buộc là chuỗi, total_amount theo DecimalString. Không thêm giới hạn nội dung, tiền dương/min/max hoặc danh sách/định dạng currency; giữ nguyên đầu vào ngày |
| Parse rule mới — xác nhận 2026-11-09 | Chỉ nhận chuỗi đúng YYYY-MM-DD và ngày tồn tại; không trim, ép kiểu hoặc nhận timestamp. Missing/null/rỗng/sai kiểu/sai định dạng/ngày không tồn tại hoặc d < R cần cờ; mới xác nhận đặc tả, chưa cài rule hoặc duyệt oracle |
| Acceptance threshold | Người dùng chưa chọn, chờ cô quy định; không sử dụng đề xuất 100% trước đây như ngưỡng hiện hành |
| Ranh giới nghiệp vụ | Một quy tắc flag để con người xem xét; ứng dụng gốc chưa có rule đó. Reviewer duyệt code/artifact, không duyệt báo giá |

### Quy tắc ngày đã thống nhất với người dùng

Ngày hết hạn phải biểu diễn đúng ngày tồn tại theo lịch với định dạng YYYY-MM-DD và thỏa **d >= R**, trong đó d là ngày hết hạn đã diễn giải hợp lệ, R là ngày tham chiếu. Với fixture, **R = 2026-11-07** cố định cho mọi lượt; không lấy ngày từ máy hoặc đổi mốc theo ngày chạy. So sánh theo ngày, không tự thêm giờ hết hạn hay múi giờ vào input date-only. Ngày 2026-11-09 người dùng xác nhận parse nghiêm ngặt: không trim/ép kiểu/nhận timestamp; missing/null/rỗng/sai kiểu và ngày sai hoặc trước R đều cần cờ sau khi có rule. Cách cung cấp R ngoài fixture còn cần chốt trước implementation tương ứng. [Bảng oracle T07](../evaluation/design.md#bảng-oracle-t07-để-review) là bản nháp review, chưa được duyệt hoặc đóng băng.

Báo giá thiếu ngày, ngày không hợp lệ hoặc d < R phải có cờ cần xem xét; ngày bằng/sau R không phát sinh cờ này, các validation khác giữ nguyên. Đây là quyết định của người dùng ngày 2026-11-07, chưa phải bằng chứng giảng viên đã xác nhận oracle/fixture hoặc acceptance. Quy tắc chỉ được bổ sung vào bản sửa, không cài trước vào app nền.

### Schema báo giá tối thiểu — phạm vi đã chốt

Người dùng đã chọn bộ 6 trường dưới đây cho phạm vi nhập/danh sách/chi tiết/validation. Đã có Pydantic model, schema/store PostgreSQL và API/UI tạo/đọc/phân trang; chưa có runtime validation ngày. Không bao gồm quản lý mua hàng/thanh toán hoặc nhiều dòng hàng.

| Trường dự kiến | Mục đích |
| --- | --- |
| id | Định danh báo giá do ứng dụng quản lý |
| supplier_name | Tên nhà cung cấp giả lập để hiển thị |
| description | Nội dung báo giá ngắn |
| total_amount | Chuỗi DecimalString giữ nguyên precision/lexeme, không áp min/max hoặc tiền dương |
| currency | Đơn vị tiền tệ minh họa, chưa chốt danh sách |
| expires_on | Giá trị ngày hết hạn đầu vào; giữ phân biệt thiếu field, null, rỗng và giá trị thô cho validation/fixture |

T02 có [wire contract v0.2](../system/api.md#dữ-liệu-ứng-dụng-báo-giá); phần đã triển khai tại [schema/storage báo giá](../system/architecture.md#lưu-trữ-báo-giá-đã-triển-khai). Theo lựa chọn người dùng ngày 2026-11-09, validation nền giữ nguyên contract: tiền là chuỗi thập phân hữu hạn, không làm tròn/áp min-max; chuỗi rỗng/khoảng trắng và currency ngoài danh sách vẫn được tiếp nhận. expires_on giữ JsonValue/absent, không parse date ở domain/storage. Không thêm validator rỗng hoặc cài rule ngày vào app nền; oracle nghiên cứu vẫn cần review.

Kết quả validation mục tiêu có danh sách cờ, với cờ expiration_review cho rule mới; shape đề xuất ở [API](../system/api.md#quotationvalidation), chưa có endpoint thực thi. Không nhận cờ do client/Agent gửi như kết quả validation đáng tin cậy. Khi ca ngày sai thuộc fixture, parsing/chuẩn hóa ở API không được làm mất dấu hiệu đầu vào khiến rule nghiệp vụ không còn được kiểm tra. Test nền và schema nền không được bổ sung trước chính rule mà Agent sẽ được giao.

Vai trò Developer, Reviewer và Deployment Control đã có trong thiết kế. Người dùng chọn identity fixture do backend quản lý cho PoC, không triển khai đăng nhập thật ngay từ đầu; đây là mô phỏng danh tính, không phải production authentication. Developer được tự duyệt nếu có quyền Reviewer hiện tại và thực hiện quyết định tường minh; không yêu cầu reviewer phải khác người đề xuất. Mapping/freshness API báo giá đã chốt riêng trong bảng trên; mapping control/repo/reviewer vẫn cần chốt trước thực thi, không tự biến ba capability thành yêu cầu ba tài khoản riêng. Fixture/oracle, acceptance và baseline/số lặp vẫn chờ xác nhận theo [thiết kế đánh giá](../evaluation/design.md).

## Acceptance threshold cần thống nhất

**Chưa chọn ngưỡng; người dùng chờ cô quy định.** Phương án 100% ca validation và 100% ca gate từng được đề xuất chưa được chọn, không phải cấu hình mặc định hoặc điều kiện nghiệm thu hiện hành. Phải ghi giá trị/đơn vị, danh sách ca bắt buộc, cách tính mẫu số/lỗi và version trước thực nghiệm; không điều chỉnh theo kết quả đã quan sát.

Test thiếu/lỗi/timeout hoặc bằng chứng không xác minh được không được giả thành pass. Cả năm chiều vẫn cần báo cáo theo protocol sau khi được chốt; chưa có threshold thì không kết luận run đạt acceptance. Ngưỡng này khác similarity threshold của cache; không chặn việc soạn nháp kiến trúc/API độc lập với giá trị ngưỡng, nhưng chặn đóng băng acceptance và thực nghiệm phụ thuộc.

## Giả định và câu hỏi mở

| Chủ đề | Cần xác nhận trước bước phụ thuộc |
| --- | --- |
| Schema báo giá | Bộ sáu trường và wire contract đã có; người dùng xác nhận giữ validation nền hiện tại ngày 2026-11-09. Giữ nguyên ca missing/null/raw của expires_on; không thêm ràng buộc nội dung |
| Ngày hết hạn hợp lệ | Đã chọn YYYY-MM-DD, ngày có thật và d >= 2026-11-07 cho fixture; đã xác nhận parse nghiêm ngặt, không trim/ép kiểu/nhận timestamp. Còn nguồn R ngoài fixture và review oracle; không thêm ngày phát hành hay giờ/múi giờ |
| Một fixture | Đề xuất một manifest phiên bản gồm báo giá có nhãn và ca control/cache/trace có liên kết; cần xác nhận cách diễn giải này với giảng viên, không thêm fixture thực nghiệm độc lập |
| Threshold | Người dùng chờ cô quy định ngưỡng; chưa chọn giá trị. Cần xác nhận danh sách test bắt buộc, đơn vị/mẫu số và cách tính run lỗi/timeout trước thực nghiệm |
| Baseline và lặp | Baseline được dùng công cụ nào, có cấm AI không; ai thực hiện; số lần lặp, thứ tự và biện pháp giảm học thuộc tác vụ? |
| Agent và repository | Adapter/provider/model/revision, tool scope, executor, ngôn ngữ app mẫu, giới hạn đọc/ghi/chạy test; loại bỏ secrets/symlink vượt scope thế nào? |
| Identity và gate | Đã chốt mapping/freshness reader/operator riêng API báo giá và self-approval khi Developer có quyền Reviewer. Còn mapping principal/tenant/repo/control, ABAC, freshness cache/gate, deploy target và đường bypass ngoài threat model |
| Exact change | Chuẩn hóa diff, base/source revision, artifact digest, test/fixture/config binding, expiry/revoke approval; cơ chế toàn vẹn và kiểm tra nguyên tử tại deployment? |
| Cache | Đã chọn Context Cache trong trình duyệt/web Workspace trước. Còn trusted metadata/integrity, storage engine, model/metric/threshold, TTL, scope chia sẻ, invalidation và logout/account switch; offline mặc định đề xuất không reuse |
| Bằng chứng riêng cache | Các câu hỏi tìm hiểu repo thực sự lặp lại trong một nhiệm vụ; preload hợp lệ, số query đủ báo cáo, oracle reuse và cách tính tiền xử lý/chi phí? |
| Phương pháp và tài liệu nền | Cỡ mẫu, seed, biến động model, giới hạn thống kê; chưa tìm thấy research notes hoặc bản tóm tắt bài báo trong repo, cần bổ sung nguồn thật khi có |

Quyết định ảnh hưởng bảo mật, nghĩa nghiệp vụ hoặc tính đúng nghiên cứu phải được xác nhận và ghi trạng thái. Hiện chưa có dữ liệu thực nghiệm cho bối cảnh mới.
