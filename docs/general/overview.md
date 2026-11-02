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

Trong kiến trúc mục tiêu, Supplier Quotation Management sẽ là ứng dụng mẫu tối giản có code thật trong cùng repository, tiếp nhận và kiểm tra báo giá giả lập; hiện chưa có ứng dụng này. Trạng thái gốc chuẩn bị cho thí nghiệm phải chưa có quy tắc ngày hết hạn mới. Developer yêu cầu Agent tìm validation và thêm cờ human review cho báo giá thiếu ngày hợp lệ; đây là ý nghĩa nghiệp vụ, chưa phải tên field/API chốt. Cờ không tự từ chối báo giá, không phê duyệt mua hàng và không mở rộng sang quy tắc nghiệp vụ khác.

CacheSec dự kiến cung cấp workspace, authorized repository retrieval, đề xuất diff, chạy test, duyệt thay đổi và trace. Reviewer duyệt **thay đổi code/artifact**, không duyệt báo giá. Deploy trong PoC được đề xuất là kích hoạt artifact trong môi trường giả lập có gate thật; mức fidelity và ranh giới kiểm soát cần thống nhất trước triển khai, không gọi một nút UI mô phỏng là deployment control.

## Yêu cầu chức năng mục tiêu

| ID | Yêu cầu | Bằng chứng cần có khi triển khai |
| --- | --- | --- |
| FR-01 | App báo giá tối giản và trạng thái gốc không có rule mới | Code và test hiện trạng chạy được, revision gốc được ghi |
| FR-02 | Một fixture có nhãn, định nghĩa ngày hợp lệ và thời điểm tham chiếu cố định | Manifest/hash bất biến, ca biên và oracle được duyệt trước thực nghiệm |
| FR-03 | Answer Cache cục bộ, embedding, exact/semantic matching và threshold | Hit/Miss/Rejected thật; kiểm tra tương đương, không gán hit từ mô phỏng |
| FR-04 | Authorization và cache verification trước reuse | Identity/tenant/repo, scope/intent, nguồn/version/hash, TTL, policy và toàn vẹn; lỗi thì không reuse |
| FR-05 | Authorized Repository Retrieval/RAG khi miss/reject | Chỉ đọc nguồn được phép, có provenance; lỗi quyền không biến thành truy xuất không hạn chế |
| FR-06 | Agent tạo patch đúng một rule và chạy kiểm thử thật | Diff, revision, kết quả validation/gate và lỗi có liên kết |
| FR-07 | Một approval gate chung cho cả hai workflow | Chặn chưa duyệt/sai quyền/sai phiên bản; chỉ deploy đúng artifact được duyệt, backend/control thực thi |
| FR-08 | Trace và evaluation | Truy ngược request → context/cache → patch → test → approval → deployment; ghi năm chiều đo và chỉ số cache riêng |
| FR-09 | Admission, TTL, eviction, invalidation và cấu hình có phiên bản | Namespace riêng cho cấu hình/vector; nguồn/policy đổi phải kiểm tra lại; không cache quyết định deployment approval |

Repository Context Cache là mở rộng đề xuất, không bắt buộc cho PoC đầu tiên. [Thiết kế cache](../system/cache.md) giải thích lựa chọn ít thay đổi nhất. Server cache, so sánh nhiều embedding/eviction, hai tầng cache và fine-tune/FL được giữ làm khả năng mở rộng, chưa là deliverable của kịch bản duy nhất.

## Yêu cầu phi chức năng

| ID | Yêu cầu |
| --- | --- |
| NFR-01 | Không tin quyền/metadata client tự khai; fail closed khi không xác minh được; nêu rõ freshness và giới hạn local plaintext |
| NFR-02 | Khóa repo gốc, fixture, gate implementation, acceptance rule và cấu hình đo trước run; lưu phiên bản và mọi lỗi/timeout |
| NFR-03 | Đo end-to-end và thành phần thực tế, không dùng độ trễ demo hoặc usage 0 để kết luận tiết kiệm |
| NFR-04 | Dữ liệu giả lập, log tối thiểu đủ audit, không ghi secrets hoặc code ngoài scope được cấp quyền |
| NFR-05 | Theo cấu trúc Next.js/TypeScript, FastAPI/Python hiện có; tách nghiệp vụ khỏi UI/storage và adapter khỏi provider; không dựng ERP/microservice/plugin framework |

Safety property bắt buộc là **một** thuộc tính về deployment approval. Các điều kiện cache, quyền nguồn và chất lượng là yêu cầu bảo đảm reuse/đánh giá kiến trúc, không đổi thành nhiều bài toán nghiệp vụ hoặc nhiều software changes.

## Acceptance threshold cần thống nhất

Đề xuất **một điều kiện tổng hợp**: mỗi run đạt khi 100% ca validation bắt buộc và 100% ca gate bắt buộc trong cùng fixture đều pass; thiếu test, lỗi, timeout hoặc kết quả không xác minh được không được tính pass. Đây chưa phải threshold đã được giảng viên phê duyệt. Trace, reproducibility, thời gian và failures vẫn phải đo, kể cả khi không tham gia điều kiện tổng hợp. Không điều chỉnh threshold sau khi nhìn kết quả để nâng tỷ lệ đạt.

## Giả định và câu hỏi mở

| Chủ đề | Cần xác nhận trước bước phụ thuộc |
| --- | --- |
| Ngày hết hạn hợp lệ | Field nào; thiếu/null/rỗng/sai định dạng/ngày không tồn tại/đã hết hạn xử lý ra sao; timezone, ngày bằng mốc, ngày so với ngày phát hành; dùng mốc cố định thay đồng hồ thực? |
| Một fixture | Đề xuất một manifest phiên bản gồm báo giá có nhãn và ca control/cache/trace có liên kết; cần xác nhận cách diễn giải này với giảng viên, không thêm fixture thực nghiệm độc lập |
| Threshold | Điều kiện tổng hợp trên có được chấp thuận không; danh sách test bắt buộc và cách tính run lỗi/timeout? |
| Baseline và lặp | Baseline được dùng công cụ nào, có cấm AI không; ai thực hiện; số lần lặp, thứ tự và biện pháp giảm học thuộc tác vụ? |
| Agent và repository | Adapter/provider/model/revision, tool scope, executor, ngôn ngữ app mẫu, giới hạn đọc/ghi/chạy test; loại bỏ secrets/symlink vượt scope thế nào? |
| Identity và gate | Nguồn identity/tenant, role/ABAC, ai có quyền duyệt; self-approval có cho phép không; freshness khi thu hồi; deploy PoC là gì và đường bypass nào ngoài threat model? |
| Exact change | Chuẩn hóa diff, base/source revision, artifact digest, test/fixture/config binding, expiry/revoke approval; cơ chế toàn vẹn và kiểm tra nguyên tử tại deployment? |
| Cache | Vị trí local trình duyệt còn phù hợp với Agent không; trusted metadata/integrity; metric/threshold, TTL, scope chia sẻ, invalidation; offline mặc định đề xuất không reuse |
| Bằng chứng riêng cache | Các câu hỏi tìm hiểu repo thực sự lặp lại trong một nhiệm vụ; preload hợp lệ, số query đủ báo cáo, oracle reuse và cách tính tiền xử lý/chi phí? |
| Phương pháp và tài liệu nền | Cỡ mẫu, seed, biến động model, giới hạn thống kê; chưa tìm thấy research notes hoặc bản tóm tắt bài báo trong repo, cần bổ sung nguồn thật khi có |

Quyết định ảnh hưởng bảo mật, nghĩa nghiệp vụ hoặc tính đúng nghiên cứu phải được xác nhận và ghi trạng thái. Hiện chưa có dữ liệu thực nghiệm cho bối cảnh mới.
