# Thiết kế frontend

## Báo giá — nối API thật ngày 2026-11-09

Route /quotations mở từ sidebar hoặc liên kết Báo giá trên toolbar Workspace; IDE giữ hai vùng code/chat. Trang dùng UI kit hiện có: form tạo bên trái, danh sách và chi tiết bên phải, mobile xếp dọc. Không có dữ liệu/phản hồi thành công mẫu. Tạo, làm mới, tải thêm và chọn chi tiết gọi API báo giá độc lập, lưu/đọc PostgreSQL; mã do server cấp.

- Kết nối bằng token fixture nhập ở ô password; token chỉ giữ trong bộ nhớ component, không lưu cookie/localStorage/sessionStorage hoặc cấu hình public. Rời route/reload/ngắt kết nối xóa phiên UI; 401 xóa dữ liệu và yêu cầu kết nối lại. Client không có dropdown role/tenant hoặc token mặc định; backend vẫn quyết định quyền, kể cả khi người dùng tự gọi API.
- QuotationHttpClient tách khỏi hook/UI, nhận fetch adapter để kiểm thử. Chỉ tin response đúng contract v0.2/identity fixture; lỗi mạng/schema/quyền không đổi thành dữ liệu giả hoặc thông báo lưu thành công. Request không dùng browser credentials/cache; redirect bị từ chối. Hook abort và kiểm tra request hiện tại để response đến trễ không khôi phục dữ liệu sau đổi/ngắt phiên.
- Form giữ chuỗi tiền, không ép Number hoặc làm tròn; ngày có bốn dạng missing, chuỗi (kể cả rỗng/sai lịch), null và JSON thô. Không parse/validate lịch hoặc sinh expiration_review; ghi ngắn Chưa kiểm tra ngày hết hạn. Chi tiết thể hiện đủ sáu trường và JSON mở khi cần; missing khác null/chuỗi rỗng.
- Mỗi lần tạo có Idempotency-Key riêng. Khi mất response hoặc gặp lỗi chưa rõ kết quả, giữ nguyên body/key trong bộ nhớ, khóa sửa form và cho Thử lại lần gửi. Thành công chỉ sau response hợp lệ; refresh danh sách lỗi không biến báo giá đã lưu thành lần gửi chưa thành công. Reload/rời route mất key đang chờ: cần xem lại dữ liệu trước khi tạo lại; chưa có recovery bền vững qua reload hoặc audit workflow.

Nguồn ở features/quotations, CSS scope quotations.css; route chỉ lắp ghép. NEXT_PUBLIC_QUOTATION_API_URL là địa chỉ public của API, **không chứa token**. CORS, quyền và lệnh chạy/kiểm tra tại [setup](../general/setup.md#2b-api-báo-giá-độc-lập), [API](../system/api.md#http-báo-giá-đã-triển-khai) và [authorization](../system/authorization.md#quyền-api-báo-giá-đã-triển-khai). Đây là kết nối app báo giá; Agent/code/review/test/deploy trong Workspace vẫn mô phỏng.

## Developer Workspace — bản xem trước ngày 2026-11-02

Theo quy tắc tối giản chữ: không có lời giới thiệu, mô tả nhiệm vụ lặp, phần tổng kết diff hoặc footer quảng bá. Ghi chú mã/test mở khi cần; điều kiện duyệt và trạng thái chưa kết nối triển khai vẫn rõ.

Đã thêm route `/workspace` và mục Workspace đầu sidebar, dùng chung tokens Nói, Button/Select/Checkbox/Icon và app shell. Các route Chat, Thiết lập, Số liệu và Tài liệu giữ hành vi cũ. Metadata gốc mô tả định hướng Secure Local Semantic Cache cho phát triển phần mềm; trang mới có title Developer Workspace · CacheSec.

Từ yêu cầu bố cục IDE ngày 2026-11-07, màn chính chỉ có code bên trái và chat Agent bên phải, cao theo viewport và cuộn nội dung riêng. Dưới 1024 px hai vùng xếp dọc. Toolbar nhỏ giữ Workspace, nhãn Mô phỏng, Kiểm thử, Phê duyệt và nút Bắt đầu lại dạng icon. Không có card nhiệm vụ, progress, banner, breadcrumb, metadata repository/branch, nhãn vai trò/avatar, hội thoại có sẵn, thẻ cache hay gợi ý. Nhãn mô phỏng và trạng thái chỉ đọc phân biệt bản mẫu với Agent/code thực thi.

- Chat Agent bắt đầu trống, ô nhập ghim dưới vùng chat; phản hồi từ fixture cục bộ, không gọi model hoặc đọc repo. Nội dung người nhập được React render dạng text, tên vai trò chỉ giữ cho trình đọc màn hình. Enter gửi, Shift+Enter xuống dòng; Bắt đầu lại xóa hội thoại.
- Workspace không còn điều khiển kịch bản cache. Thiết kế cache và các màn Chat/Số liệu cũ được giữ; chưa có lookup/verification hoặc số đo thật.
- Vùng code có tab tên file `service.py`, nhãn Python, revision, Diff/Bản gốc và số dòng. Nội dung `quotation_demo/service.py` là minh họa, chưa phải file thật; `policy.is_valid_expiration` là placeholder cho định nghĩa ngày chưa chốt. Mục Mã mẫu · Chỉ đọc chứa ghi chú và nút Thử bản sửa khác, đổi revision/nội dung mẫu và đặt lại test/approval.
- Nút Kiểm thử mở hộp thoại có bốn ca và nút Xem kết quả mẫu. Các trạng thái Đạt là fixture UI có sẵn, không phải test nghiệp vụ đã chạy, fixture đóng băng hoặc acceptance threshold. Ngày hết hạn/múi giờ còn mở được ghi riêng.
- Nút Phê duyệt mở hộp thoại mô phỏng reviewer/developer. Chỉ cho duyệt mẫu sau xem kết quả, xác nhận diff đúng revision và chọn reviewer; có Yêu cầu chỉnh sửa. Đổi revision/vai trò đặt lại duyệt. Đây là logic trình bày, **không phải RBAC/ABAC hoặc approval gate backend**. Artifact/hash chưa có và Triển khai luôn khóa. Hộp thoại dùng native dialog, giữ focus trong modal, Escape/nút đóng trả focus về nút mở.
- Nhật ký thu gọn trong hộp thoại Phê duyệt, ghi thứ tự thao tác demo trong phiên, không giả timestamp/digest hoặc audit evidence. Bắt đầu lại xóa trạng thái nhiệm vụ mẫu. State nằm trong component; rời route rồi quay lại hoặc reload bắt đầu phiên mẫu mới.

Model/reducer và fixture tách khỏi UI tại `src/features/developer/`; CSS scope ở `styles/developer.css`. Test logic kiểm tra điều kiện duyệt và revision stale của mô phỏng; browser check kiểm tra thao tác, keyboard, không tràn ngang và không giả deployment. Những test này không chứng minh safety property backend. So sánh workflow và cache dashboard thật vẫn chưa triển khai.

## Định hướng mục tiêu còn lại

Từ 2026-11-02, CacheSec nghiên cứu Secure Local Semantic Cache for AI-Assisted Software Development trong [kịch bản báo giá duy nhất](../general/overview.md). Workspace ở trên là bước xem thử UI; bảng dưới là định hướng tích hợp thật. Các phần chi tiết về bốn màn cũ bên dưới tiếp tục mô tả **As-Is**, không phải workflow Agent/approval đã hoạt động.

| Thành phần hiện có | Tái sử dụng mục tiêu | Cần bổ sung, chưa triển khai |
| --- | --- | --- |
| Chat `/`, lịch sử và ô nhập chung | Developer Workspace: request tìm hiểu repo và yêu cầu đúng một thay đổi code | Repo/snapshot/scope, context có provenance, Agent adapter/tool status; không coi hai phản hồi mẫu là Agent |
| Vòng Hit/Miss/Rejected, modal thông số | Cache Lookup & Verification Trace | Candidate/score/intent, source hashes, backend verification và lý do reject; hiện chưa có cache visualization/trace thật |
| Số liệu `/metrics` | Workflow Evaluation và Cache Evaluation tách biệt | Năm chiều chính Developer-guided/AI-assisted; phần phụ AI Cache/No Cache/cold-warm; telemetry và mẫu số thật |
| Thiết lập `/setup` | Experiment Configuration | Frozen source/fixture/gate/acceptance versions, model/Agent/tool policy, reset/preload protocol; không tự dùng manifest nội bộ cũ |
| Tài liệu `/documents` | Nguồn repository/provenance được phép | Snapshot/file/symbol và quyền đọc hiện tại; không biến chọn tệp trong phiên thành authorized RAG |
| Vùng code ở Workspace (mẫu) | Change Review thật | Diff chính xác, base/patch/artifact/fixture/test hashes, test results và trạng thái lỗi |
| Hộp thoại Phê duyệt ở Workspace (mẫu) | Approval Center thật | Reviewer/authority, quyết định tường minh đúng change, trạng thái backend/control và deployment audit |

Đây là phương án kiến trúc tích hợp thật, chưa chốt thêm route ngoài `/workspace` xem trước. Tái sử dụng components/layout/tokens và state patterns; không xóa màn cũ hoặc đổi package/path. UI comparison Cache/No Cache được giữ làm nền phép thử phụ, không đổi tên nó thành so sánh Developer-guided/AI-assisted khi chưa có hai workflow thật.

Luồng mục tiêu: Developer request → cache/retrieval trace → Agent proposal → diff/test → human approval → deployment decision/audit. Câu hỏi tra cứu có thể kết thúc ở answer đã xác minh; thao tác deploy phải kiểm soát ở backend, nút UI không cấp phép. Cache verification không thay approval, test pass không thành approved, mã/artifact đổi sau duyệt phải thể hiện revision mới cần test/approval lại.

UI tương lai cần hiển thị rõ trạng thái mô phỏng/đo thật theo dữ liệu, unknown/error/timeout và IDs/digests của evidence; tránh trình bày local hit là “đã được duyệt triển khai”. Approval dùng cho code, không dùng làm quyết định chấp nhận báo giá. Thiết kế gate và payload tin cậy thuộc [authorization](../system/authorization.md), protocol/mẫu số thuộc [evaluation](../evaluation/design.md); UI không tự tính quyền hoặc dựng approval log.

Fine-tune/FL, sweep nhiều policy/embedding/eviction và server-cache benchmark trong UI cũ chưa là phạm vi PoC ưu tiên. Xem [lộ trình](../general/implementation-plan.md) trước thay giao diện.

## UI đang có (As-Is)

Ngoài Workspace xem trước, bốn khu cũ được giữ từ mốc 2026-10-29:

- **Thiết lập:** chuẩn bị cấu hình và điều kiện thí nghiệm, lưu bản kế hoạch trong phiên.

- **Chat:** trao đổi với trợ lý nội bộ, lịch sử, chat mới và chọn không cache/có cache/so sánh chia đôi qua nút bánh răng.
- **Số liệu:** dashboard trực quan bám các tiêu chí đánh giá đồ án, ngay sau Chat và trước Tài liệu.
- **Tài liệu:** chọn/thả tệp, phân loại và tìm/lọc danh sách.

So sánh hai nhánh nằm trong Chat với một ô nhập chung. Yêu cầu ngày 2026-10-29 bổ sung trang Thiết lập tối giản; runner và benchmark vẫn chưa triển khai. Các tham số thí nghiệm chỉ nằm ở Thiết lập, không đưa vào luồng hỏi đáp.

## Route và trạng thái thực tế

| Route | Giao diện | Giới hạn |
| --- | --- | --- |
| `/workspace` | Developer Workspace xem trước | Chat, diff, test, approval và trace mô phỏng; chưa có backend/Agent/deployment |
| `/setup` | Thiết lập cache và kế hoạch thí nghiệm | Chỉ lưu nháp trong phiên; chưa áp dụng vào Chat, cache hay benchmark |
| `/` | Chat nội bộ, lịch sử trong sidebar, gợi ý hỏi, gửi/sao chép, chat mới và ba chế độ qua nút bánh răng | Phản hồi mẫu; chưa gọi AI/RAG hoặc cache thật |
| `/metrics` | Dashboard, lọc hội thoại, biểu đồ, đánh giá chất lượng/quyền và chi tiết lượt gửi | Tổng hợp phiên mô phỏng; chưa có telemetry hoặc nhãn đánh giá thật |
| `/documents` | Chọn nhiều tệp, kéo thả, danh mục khi thêm, đổi danh mục từng tệp, tìm tên/lọc/bỏ khỏi danh sách | Tệp chỉ trong bộ nhớ trình duyệt, chưa tải lên server hay được chatbot đọc |
| `/chat`, `/settings`, `/experiments` | Chuyển về Chat để giữ liên kết cũ | Không mở lại màn tham số/thí nghiệm |
| `/ui` | Thư viện 21 component, truy cập trực tiếp cho phát triển | Không có mục điều hướng trong app chính |

Sidebar theo thứ tự Workspace → Báo giá → Thiết lập → Chat → Số liệu → Tài liệu. Lịch sử chat dùng cùng sidebar, không tạo thêm cột điều hướng. Thanh đầu trang Chat giữ Thông số và cài đặt ở góc phải; đã bỏ nhãn Mô phỏng và phần giới hạn mở từ nhãn đó. Nội dung và hành động giữ ngắn, dùng hệ màu/font/border của Nói.

Lịch sử và nút Chat mới nằm lồng ngay dưới mục Chat, trước Số liệu. Mặc định thu gọn; bấm Chat hoặc mũi tên để mở/đóng với hiệu ứng chiều cao và độ mờ (tắt khi giảm chuyển động). Mỗi lần mở hiện 5 hội thoại đầu danh sách, theo thứ tự mới tạo trước; **Hiển thị thêm** mở tiếp từng nhóm 5 và ẩn khi hết. Hội thoại đang chọn được tô nền, tên dài rút gọn bằng dấu ba chấm. Có thể chọn lịch sử từ Số liệu/Tài liệu để trở về đúng hội thoại; giữ bản nháp và chế độ. Trên điện thoại, mở lịch sử giữ drawer để chọn; chọn hội thoại/Chat mới đóng drawer. Nội dung thu gọn không nhận focus hoặc xuất hiện với trình đọc màn hình; nút mũi tên hỗ trợ bàn phím và báo trạng thái mở/đóng.

## Thiết lập thí nghiệm

Mục này ghi lại UI nháp hiện có để bảo toàn công việc trước. Dataset tài liệu nội bộ, alias embedding, threshold/TTL mặc định và ma trận dự kiến **không phải fixture hoặc protocol báo giá đã được chốt**. Chưa chuyển cấu hình này sang yêu cầu thực nghiệm mới.

Trang `/setup` dùng hai cột **Thông số / Chức năng** trên desktop; mobile xếp tên, mô tả và điều khiển của từng nhóm theo chiều dọc. Tên thí nghiệm ở đầu; chín nhóm theo yêu cầu ngày 2026-10-29:

| Thông số | Điều khiển |
| --- | --- |
| Experiment Mode | Chọn một hoặc nhiều No Cache / Local Cache / Server Cache; mặc định No Cache và Local Cache. Cache có TTL giây và dung lượng mục; scope dự kiến riêng người dùng, tách khỏi vị trí lưu. |
| Dataset | Chọn bộ câu hỏi cơ bản/lặp lại và manifest tài liệu nội bộ giả lập v1 (Quy chế nhân sự, Hướng dẫn IT). Chưa phải corpus đã nạp hoặc tệp trong trang Tài liệu. |
| Embedding Benchmark | Nhập 1–8 ID/alias model, mỗi dòng một giá trị khác nhau. embedding-a/b là alias nháp, chưa gắn provider/model/revision thật. |
| Threshold Benchmark | Nhập 1–20 ngưỡng semantic từ 0 đến 1, dùng dấu chấm thập phân và dấu phẩy phân tách; không nhận giá trị rỗng/trùng. Mặc định 0.80, 0.85, 0.90 chưa hiệu chỉnh. |
| Eviction Benchmark | Chọn FIFO / LRU / LFU, mặc định cả ba. Threshold và eviction không áp dụng khi chỉ chọn No Cache. |
| Access Control Benchmark | Chọn RBAC / ABAC / RBAC + ABAC, mặc định cả ba; chỉ là cấu hình thử nghiệm, không cấp quyền hoặc bỏ xác minh backend. |
| Local Training | Tắt / Fine-tuning cục bộ / FL mô phỏng, mặc định Tắt. Chỉ lưu ý định, chưa có pipeline hay model đích. |
| Request Logging | Bật/tắt yêu cầu ghi duration_ms, llm_tokens, cache_status, authorization_decision; mặc định bật. Chưa ghi log thật; không ghi nội dung nhạy cảm hoặc tự sinh quyết định quyền. |
| Export Results | Chọn JSON/CSV cho kết quả tương lai; nút Xuất kết quả khóa khi chưa có run. Xuất cấu hình JSON là hành động riêng sau khi lưu bản nháp. |

Điều kiện chạy giữ số lần lặp, cold/warm và seed. Cold/warm và seed chỉ ghi ý định, chưa reset/preload hoặc xáo trộn. TTL 3.600 giây và dung lượng 100 mục là nháp. UI này cấu hình semantic benchmark, không còn điều khiển exact/semantic của trang cũ; model profile nghiên cứu cũ vẫn giữ riêng.

Lưu thiết lập kiểm tra giới hạn và tạo `setup-plan` có schemaVersion, revision tăng, ID/thời điểm, snapshot các lựa chọn, manifest tài liệu và danh sách ca; results luôn null. Số cấu hình dự kiến = số embedding × số mô hình quyền × tổng biến thể theo mode: No Cache có một biến thể, mỗi mode cache có số threshold × số eviction. Số lượt dự kiến = số cấu hình × số ca × số lặp; đây là ma trận ý định, không phải lượt đã chạy hoặc bằng chứng phép đo tương đương. Cần cô lập biến nghiên cứu khi phân tích theo [thiết kế đánh giá](../evaluation/design.md).

Model/provider workspace giữ snapshot thiết lập riêng với kế hoạch hai profile cũ. Điều hướng client giữ bản đã lưu; rời trang bỏ sửa đổi chưa lưu, quay lại điền bản lưu mới nhất; tải lại xóa phiên. Sửa bất kỳ lựa chọn nào khóa xuất cấu hình đến khi lưu lại. JSON xuất có previewOnly và results null, không chứa fixture dashboard hoặc kết quả giả. Không ghi vào Chat, storage hoặc backend. Trước khi chạy thật cần chốt dataset/nhãn quyền, model/embedding, metric/ngưỡng, phiên bản corpus/policy, logging và quy trình warm. Đổi embedding phải re-embed hoặc tách namespace; lựa chọn RBAC/ABAC/FL trên UI chưa chốt chính sách quyền hoặc phương pháp nghiên cứu thực thi.

## Luồng chat

Chat → nhập/gửi câu hỏi → phản hồi mẫu → sao chép hoặc tạo chat mới. Gợi ý dùng tình huống công ty, không phải tác vụ viết bài chung. Phản hồi mẫu ghi rõ chưa nối AI hoặc kho tài liệu, không tự trả lời từ tên/nội dung tệp được chọn.

`ChatProvider` giữ hội thoại và bản nháp qua điều hướng trong phiên. Phản hồi đang chờ có thể hoàn tất khi người dùng mở Tài liệu; kết quả vẫn thuộc hội thoại gốc. Reload mất phiên; chưa lưu server hoặc browser storage. Hook điều phối vẫn tách khỏi reducer và UI, hủy tác vụ khi provider unmount.

### Ba chế độ chat

Icon bánh răng **Cài đặt chat** ở góc phải thanh trên cùng mở ba lựa chọn. Icon 16 px, nút không viền/nền với vùng bấm 32 px trên desktop (44 px trên thiết bị cảm ứng). Bỏ tiêu đề hiển thị “Chat nội bộ” và nhãn chế độ lặp để dành chỗ cho hội thoại; tên truy cập cho trình đọc màn hình vẫn được giữ.

- **Không cache**: một khung hội thoại cho nhánh không cache.
- **Cache**: một khung cho nhánh có cache; phản hồi mẫu nói rõ cache chưa triển khai.
- **Cả hai** (mặc định khi mở phiên hoặc tải lại): hai khung Không cache/Cache đặt cạnh nhau, cuộn riêng, cùng một ô nhập và nút gửi bên dưới. Gửi một lần thêm cùng prompt vào hai nhánh và khởi chạy hai phản hồi mẫu song song; mỗi nhánh có trạng thái chờ/lỗi riêng. Giữ bố cục hai cột cả ở màn nhỏ với chữ/padding gọn hơn.

Hai vùng so sánh không có viền bao quanh, nền card hoặc đường kẻ tiêu đề; giữ nhãn nhỏ Không cache/Cache và một vạch dọc 1 px màu viền chung nằm giữa khoảng cách hai cột. Vạch chạy hết chiều cao vùng hội thoại, dừng trước thanh nhập, không chặn thao tác chuột và chỉ hiện ở chế độ chia đôi, kể cả trên mobile. Giảm padding ngoài, bỏ nội dung chờ lặp ở hai vùng trống, nhãn Mô phỏng và tên vai trò lặp trên tin nhắn. Giữ giới hạn trong menu/phản hồi mẫu, trạng thái chờ/lỗi và thao tác sao chép. Hướng dẫn phím gửi dùng chữ ẩn cho trình đọc màn hình; placeholder và nút Gửi phục vụ thao tác chính.

Thanh nhập dùng cùng thiết kế và chiều rộng ở cả ba chế độ (tối đa 1120 px, co theo màn hình). Textarea và nút Gửi nằm cạnh nhau trong cùng một hàng có viền chung; nút bám cạnh dưới khi nhập nhiều dòng. Ô nhập cao tối thiểu 44 px, tự giãn đến 160 px rồi cuộn nội dung, thu gọn lại sau gửi và điều chỉnh theo bản nháp/chiều rộng màn hình. Enter gửi, Shift+Enter xuống dòng; thông báo nhập rỗng đặt dưới thanh để không đẩy nút Gửi sang hàng khác.

Chế độ, bản nháp và lịch sử hai nhánh thuộc từng hội thoại; đổi chế độ không xóa hoặc chuyển nội dung giữa hai nhánh. Khi vào so sánh sau các lượt chat đơn, mỗi bên tiếp tục lịch sử riêng đã có. Chat mới kế thừa chế độ đang chọn và bắt đầu với lịch sử rỗng. Đổi chế độ và tạo chat mới tạm khóa đến khi mọi nhánh của lượt gửi hoàn tất; vẫn có thể xem hội thoại khác hoặc mở Tài liệu.

Mỗi lượt có ID và danh sách nhánh đang chờ để bỏ qua phản hồi trùng, phản hồi của lượt cũ hoặc sai nhánh. Một nhánh lỗi không hủy kết quả nhánh còn lại. Hai nhánh hiện chỉ là mô phỏng UI, cùng độ trễ mô phỏng; chưa có lookup/reuse cache, xác minh quyền, hit/miss, số đo tốc độ/token/chi phí hoặc kết quả benchmark. Lựa chọn Cache chưa chốt vị trí local/server.

### Thông số theo lượt gửi

Nút **Thông số** chỉ hiện icon biểu đồ trên cả desktop/mobile, giữ tên truy cập và tooltip Thông số. Icon này nằm ngay bên trái bánh răng cài đặt trong cùng một nhóm ở góc phải thanh trên cùng, cách nhau 4 px, vùng bấm 32 px trên desktop hoặc 44 px trên thiết bị cảm ứng. Nút mở một cửa sổ modal có hai cột Không cache/Cache và vạch ngăn giữa. Escape hoặc nút đóng trả focus về nút mở; nội dung cửa sổ cuộn khi thiếu chiều cao.

Giao diện dùng lại tokens Nói, Button, Select và Badge từ UI kit. Modal nền trắng, bo góc; phần chọn/câu hỏi nằm trong khối riêng, hai bảng có viền trung tính và tiêu đề chữ đậm. Bỏ icon trang trí ở tiêu đề/nhánh/chỉ số, các mảng nền và viền xanh dương/tím, cùng dòng “Chưa đo AI/cache. LLM chưa được gọi.” và nhãn Mô phỏng. Giữ nút đóng và icon mở cửa sổ. Nhấn bằng chữ đậm và màu chữ theo nhóm chỉ số (xanh trầm, cam/nâu, vàng nâu), dùng cùng màu cho cùng chỉ số ở cả hai nhánh. Trạng thái chờ/chưa xác minh dùng chữ vàng nâu, lỗi dùng chữ đỏ theo trạng thái thực tế; màu chữ không biểu thị cache hit, quyền ALLOW hay hiệu năng tốt hơn. Giữ các hàng căn tương ứng và hai cột trên mobile; cuộn trong cửa sổ khi cần.

Dropdown liệt kê các lượt gửi trong hội thoại đang mở, mới nhất trước, mặc định chọn lượt gần nhất mỗi lần mở cửa sổ. Hiển thị đầy đủ prompt đã chọn bên dưới. Một lượt chia đôi chỉ có một mục; gửi lại cùng câu vẫn tạo mục riêng theo ID lượt và số thứ tự. Bản nháp/câu rỗng không vào danh sách; đổi chế độ không thay snapshot của lượt cũ. Không trộn lượt từ các hội thoại khác; reload xóa phiên. Khi chưa gửi câu nào, dropdown bị khóa và các giá trị là “—”.

Hai cột luôn có cùng năm trường, kể cả khi lượt đó chỉ chạy một nhánh:

| Trường | Ý nghĩa khi có backend thật | Hiện tại với phản hồi mẫu |
| --- | --- | --- |
| Cache Status | Hit / Miss / Rejected | Nhánh không cache: Không áp dụng; nhánh có cache: Chưa xác định |
| Thời gian phản hồi | Thời gian phản hồi của nhánh; cách đo end-to-end cần đặc tả khi nối backend | Chưa đo; không dùng độ trễ mô phỏng làm số đo AI/cache |
| Lượt gọi LLM | Số lượt gọi LLM của nhánh | 0 vì demo không gọi model |
| Token LLM | Token sử dụng bởi LLM; cần chốt hợp đồng usage | 0 vì demo không gọi model |
| Kiểm tra quyền | ALLOW / DENY từ backend | Chưa xác minh; không suy ra quyền từ phản hồi mẫu hoặc lỗi |

Nhánh không được chạy ở lượt đó ghi **Không chạy** cho cả năm trường, không gán số 0 hay trạng thái cache/quyền. Trạng thái chờ/hoàn tất/lỗi của từng nhánh được lưu theo lượt để xem khi đang chạy và cập nhật đúng lượt khi phản hồi về. Lỗi nhánh hiển thị riêng, không biến thành DENY hoặc Rejected. Đây là màn thông số frontend mô phỏng, chưa phải schema API hoặc kết quả benchmark; khi có backend phải dùng telemetry và quyết định quyền đáng tin cậy theo [thiết kế đánh giá](../evaluation/design.md) và [phân quyền](../system/authorization.md).

## Dashboard Số liệu

Sáu hàng nội dung bảng so sánh dùng chiều cao 64 px, padding dọc 8 px (mobile 6 px), căn giữa theo chiều dọc để bảng gọn và các hàng cân đối. Nội dung dài vẫn được phép làm hàng cao hơn để tránh cắt chữ.

Fixture mặc định minh họa đủ hơn/bằng/kém trong bảng: Cache tốt hơn ở độ trễ, calls và token; Không cache tốt hơn ở chất lượng (24/24 so với 23/24); hai bên bằng nhau ở rò rỉ và từ chối nhầm (0%). Chất lượng lưu theo từng nhánh/từng truy vấn để bảng, tab nhánh và bộ lọc tính nhất quán; đây chỉ là kịch bản xem UI.

Hai đường hiệu suất dùng cùng độ dày nét 2 px, dấu điểm màu đặc bán kính 4 px có viền nền trắng. Điểm trùng vị trí chia hai màu xanh dương/nâu cam; đoạn đường trùng vẫn đan hai màu. Cả hai nhánh dùng chung trục truy vấn và thang giá trị, có khoảng trống phía trên đỉnh và nhãn trục rút gọn. Vùng vẽ cao hơn, lưới ngang nhẹ theo mẫu tham khảo. Rê chuột hoặc chạm hiển thị hộp giá trị hai nhánh cùng truy vấn; bấm/chạm đồng bộ thanh chọn bên dưới. Giữ thanh chọn để thao tác bàn phím, không làm mượt hoặc thay đổi số liệu để tạo xu hướng giả.

Giá trị so sánh phải hữu hạn và không âm; tỷ lệ phải nằm trong 0–100%, khớp số ca/mẫu số hợp lệ. Giá trị lỗi hiển thị —, không tô bên tốt hơn hoặc hiện số ca gây hiểu nhầm. Hai giá trị hiển thị bằng nhau sau làm tròn giữ trung tính. Tập mẫu rỗng không suy ra độ trễ, usage, mức tiết kiệm hoặc vi phạm bằng 0; không có ca đánh giá thì dùng — thay cho 0/0. Vòng cache không có lượt tra giữ màu trung tính.

Trang `/metrics` mở trực tiếp từ sidebar. Thanh tab **Chung**, **Không cache**, **Cache** nằm đầu nội dung trang, trước bộ lọc dùng chung, mặc định Chung. Bỏ tiêu đề hiển thị Số liệu, nhãn Phiên hiện tại và câu mô tả ở đầu; giữ tên trang ẩn cho trình đọc màn hình. Dùng component Tabs hiện có, hỗ trợ phím trái/phải, Home/End; chỉ panel đang chọn xuất hiện và nhận focus. Chuyển tab giữ bộ lọc hội thoại; mỗi tab có biểu đồ, phân trang và chi tiết riêng, đổi bộ lọc đưa bảng về trang đầu và đóng chi tiết.

Trang mặc định hiển thị dữ liệu mẫu để xem bố cục có số liệu; đã bỏ công tắc Xem dữ liệu mẫu và dòng mô tả nguồn cạnh bộ lọc theo yêu cầu. Các nhãn mẫu trong biểu đồ/chi tiết vẫn phân biệt fixture với số đo thật. Fixture cố định gồm 24 truy vấn Cả hai trong hai hội thoại riêng: 15 Hit, 7 Miss, 2 Rejected; Rejected bỏ cache và sinh lại. Thẻ, đường biểu diễn, vòng cache, bảng đối chiếu và chi tiết cùng lấy từ một nguồn trong `metricsPreview.ts`; lọc tính lại tổng/mẫu số. Chỉ trong fixture, độ trễ là trung bình ms/truy vấn, mức giảm là phần trăm giữa hai trung bình; hit rate tính Hit/24 lượt tra, calls/token tiết kiệm là hiệu tổng hai nhánh. Các tỷ lệ chất lượng và ca quyền có mẫu số; giá trị 0 là kịch bản giả, không phải chứng minh an toàn. Những phép tính này phục vụ xem giao diện, chưa chốt đặc tả đánh giá thật.

Nguồn phiên vẫn có tại `/metrics?source=session` cho phát triển/kiểm thử, dùng `ChatProvider` và cập nhật khi phản hồi về dù đang rời Chat; `/metrics` hoặc nguồn khác dùng fixture. Thay query qua điều hướng client giữ phiên; tải lại vẫn xóa dữ liệu Chat. Dữ liệu mẫu không ghi vào hội thoại, cache, storage hoặc kết quả đánh giá. Đổi nguồn đặt bộ lọc về tất cả, chọn lại Chung, reset biểu đồ/bảng và đóng chi tiết; Back/Forward cập nhật đúng nguồn, không lưu lựa chọn vào storage. Trang dùng Suspense cho nguồn phụ thuộc query. Các quy tắc chưa đo/chưa chấm bên dưới áp dụng cho **dữ liệu phiên Chat**, độc lập với fixture xem trước.

Chỉ giữ bộ lọc tất cả hoặc một hội thoại; bỏ ô Lượt gửi, tổng hợp mọi lượt gửi trong hội thoại đã chọn. Tab Chung đếm mỗi lượt chia đôi một lần, giữ hai kết quả nhánh; prompt trùng vẫn giữ ID riêng. Tab nhánh chỉ đếm và liệt kê lượt thực sự chạy nhánh đó, bao gồm lượt chia đôi, đang chờ và lỗi. Không gán usage 0 cho nhánh không chạy. Không có bộ lọc ngày, tenant, cold/warm hay local/server giả khi chưa có dữ liệu tương ứng.

Nội dung bám [tiêu chí đánh giá](../evaluation/design.md), không thêm thống kê người dùng, doanh thu hoặc vận hành không liên quan:

- **Chung:** sáu thẻ theo thứ tự Total Queries (Tổng số câu hỏi), Safe Cache Hit Rate (Tỷ lệ sử dụng cache hợp lệ), Latency Reduction (Thời gian phản hồi giảm), LLM Calls Saved (Số lượt gọi LLM tiết kiệm), Tokens Saved (Số token LLM tiết kiệm), Security Violations (Lượt trả cache trái quyền); biểu đồ đường hiệu suất theo số truy vấn và kết quả cache ở phía trên. Bên dưới là **bảng ba cột Không cache / Tiêu chí / Cache**: tên chỉ số chỉ xuất hiện ở giữa, hai giá trị căn cùng hàng ở hai bên. Chỉ giữ sáu tiêu chí đối chiếu trực tiếp: Độ trễ (ms), Lượt gọi LLM (lượt), Token LLM (token), Câu trả lời đạt yêu cầu (%), Rò rỉ thông tin (%) và Từ chối nhầm (%). Bỏ Cache Status, Kiểm tra quyền và Semantic false hit khỏi bảng vì không có cặp chỉ số cùng nghĩa ở baseline; vẫn xem chúng trong kết quả cache, tab nhánh và chi tiết từng lượt. Dashboard không hiển thị Chi phí hoặc P50/P95. Tiêu đề chỉ có Không cache / Tiêu chí / Cache; hai tiêu đề nhánh in đậm, Không cache màu xanh dương và Cache màu nâu cam; bỏ số lượt chạy. Bỏ khối tổng phản hồi Không cache/Cache và hai thanh trạng thái dưới bảng đối chiếu. Bỏ tiêu đề hiển thị và dòng mô tả phía trên bảng; panel bắt đầu ngay bằng bảng, giữ tên vùng cho trình đọc màn hình.
- **Không cache:** thẻ độ trễ, calls, token, disclosure; biểu đồ hiệu năng chỉ có baseline, trạng thái phản hồi và chất lượng/phân quyền của baseline. Bỏ khối tổng lượt gọi LLM và ghi chú dưới biểu đồ hiệu năng ở cả hai tab riêng. Không đưa biểu đồ hit/miss hoặc đánh giá semantic false hit vào tab này.
- **Cache:** cùng nhóm thẻ/hiệu năng của nhánh cache, thêm vòng Hit/Miss/Rejected, semantic false hit, chất lượng/phân quyền và trạng thái phản hồi cache. Không vẽ baseline trong biểu đồ hoặc cột thông số.
- Thời gian chưa đo dùng khung rỗng; usage demo bằng 0 khi nhánh đã chạy, chưa có lượt thì dùng dấu gạch. Vòng cache trung tính, không vẽ lát cắt hoặc gán tỷ lệ 0% giả; chỉ có hit sau xác minh quyền/tính hợp lệ. Chất lượng/quyền chưa chấm/chưa kiểm thử, không suy ra ALLOW/DENY từ hoàn tất hoặc lỗi.
- Thanh chồng hoàn tất/đang chờ/lỗi chỉ nằm trong hai tab nhánh, tính trên các phản hồi nhánh đã chạy, kể cả lỗi; nhãn truy cập vẫn có số đếm, bỏ dòng đếm và ghi chú hiển thị dưới thanh. Đây là trạng thái demo, không phải chất lượng; timeout chưa có phép đo.
- Cả ba tab có bảng **Chi tiết từng phiên, lượt chat**, không có dòng mô tả dưới tiêu đề, phân trang 8 lượt. Tab Chung có cả hai cột nhánh và đủ hai bộ thông số; tab riêng chỉ có cột/kết quả của nhánh tương ứng. Bấm câu hỏi mở năm thông số dùng lại model Chat và hiển thị lỗi nếu có. ID bảng/biểu đồ/chi tiết riêng từng panel, không trùng khi cả ba tab cùng giữ state.

Biểu đồ **Hiệu suất theo số truy vấn** thay biểu đồ thanh tổng hợp trong tab Chung. Trục X là số truy vấn tăng dần trong bộ lọc, không phải giờ/phút; trục Y chọn Độ trễ (ms), Lượt gọi LLM hoặc Token LLM theo từng truy vấn, không phải tổng tích lũy. Hai đường Không cache/Cache giữ màu nhất quán và đều vẽ nét liền. Đoạn chồng lên nhau xen kẽ hai màu trên một nét liên tục: lớp màu xen chỉ xuất hiện tại phần giao với đường còn lại, không tạo khoảng trắng hoặc thay đổi giá trị/vị trí dữ liệu. Giữ dấu điểm và thanh đọc giá trị để phân biệt hai nhánh. Mỗi lượt Cả hai chỉ chiếm một vị trí X; prompt trùng, lượt đang chờ/lỗi vẫn có vị trí riêng. `ChatTurn.sequence` giữ thứ tự gửi chung trong phiên, độc lập thứ tự tạo hội thoại hoặc hoàn tất phản hồi; bảng chi tiết vẫn nhóm theo hội thoại như trước. Lọc một hội thoại đánh lại trục X từ 1 theo thứ tự gửi của hội thoại đó.

Thanh chọn Truy vấn mặc định theo lượt mới nhất; chọn bằng chuột/cảm ứng hoặc phím mũi tên để đọc hai giá trị. Đổi bộ lọc đưa biểu đồ về Độ trễ và lượt gần nhất; đổi tab giữ lựa chọn. Không có lượt thì khóa thanh chọn. Thiếu số đo, nhánh không chạy, NaN/Infinity hoặc giá trị âm tạo khoảng trống, không nối đường qua khoảng đó hoặc biến thành 0. Thời gian phản hồi mẫu không dùng làm độ trễ; demo chỉ vẽ usage 0 ở các nhánh thực sự chạy. Khi chưa có số đo độ trễ, giữ trục số truy vấn và ghi Chưa có số đo. Chưa thêm telemetry, timestamp, schema API, phép tính mức giảm hay kết quả benchmark; biểu đồ demo không chứng minh lợi ích khi cache ấm.

Sáu thẻ tổng quan chỉ thuộc tab Chung. Bỏ dòng tổng lượt gửi/lượt có cả hai nhánh phía trên thẻ; số câu hỏi chỉ hiển thị tại Total Queries. Total Queries lấy số lượt gửi trong phạm vi hội thoại đã lọc: một lượt gửi Cả hai chỉ tính một câu, gửi lại cùng prompt vẫn là lượt mới, giữ cả lượt đang chờ/lỗi. Năm chỉ số còn lại ghi — với tooltip Chưa đo khi chưa có telemetry/nhãn quyền đáng tin cậy. Không trừ usage demo 0 để tạo tiết kiệm, không gán hit rate hoặc Security Violations bằng 0 từ phản hồi mẫu/lỗi/DENY. Security Violations ở đây chỉ lượt trả cache trái quyền, chưa phải tổng disclosure của toàn bộ RAG. Công thức, mẫu số, đơn vị mức giảm và cách xác nhận vi phạm vẫn cần đặc tả khi có backend; chưa thêm API hoặc số đo thật.

Trong bảng đối chiếu, giá trị tốt hơn được in đậm và dùng màu của nhánh: Không cache chữ xanh dương/nền xanh nhạt, Cache chữ nâu cam/nền cam nhạt, cùng màu chú giải đường, kèm nhãn ẩn Tốt hơn. Mỗi hàng khai báo một đơn vị chung, cùng bộ định dạng cho hai cột; không đặt số lượt kiểm tra quyền cạnh số cache bị chặn. Ba tỷ lệ hiện % và số ca bên dưới: đạt yêu cầu/tất cả ca đã chấm, disclosure/ca đáng ra bị chặn, false denial/ca đáng ra được phép; fixture dùng cùng tập/mẫu số cho hai nhánh và lọc tính lại. Không có ca thì ghi —, không gán 0% từ mẫu số 0. Tỷ lệ thiếu hoặc khác mẫu số không được tô bên tốt hơn. Độ trễ, calls/token, disclosure và false denial ưu tiên thấp hơn; tỷ lệ câu trả lời đạt yêu cầu ưu tiên cao hơn. Chỉ so sánh khi hai số hữu hạn, không âm và caller đã xác lập cùng điều kiện/tập ca; cùng đơn vị hoặc mẫu số chưa đủ chứng minh tương đương. Bằng nhau, thiếu dữ liệu hoặc phép đo không tương đương giữ trung tính. Dữ liệu phiên Chat chưa có cặp đo AI/cache tương đương nên không tô bên tốt hơn, kể cả usage 0; đây là model trình bày, không phải schema telemetry/API, công thức nghiên cứu đã chốt hay quyết định quyền.

Bỏ dòng thông báo nguồn phản hồi mẫu ở đầu dashboard; các giá trị chưa đo/chưa chấm/chưa xác minh vẫn hiển thị đúng tại từng chỉ số. Reload mất dữ liệu phiên. Chưa có kết quả đo, nhãn đánh giá, runner, lưu run hoặc schema telemetry/API. Demo hai nhánh không thay benchmark; cần cặp đo tương đương, tách cold/warm và vị trí/scope cache khi nối phép đo thật. Chưa chốt thêm công thức thống kê, rubric hay chính sách bảo mật.

Giữ tokens Nói, nền trắng/viền trung tính, hai màu nhất quán cho baseline/cache. Riêng kết quả cache dùng Hit xanh lá (#16a34a), Miss xanh dương (#2563eb), Rejected đỏ hồng (#e11d48), đồng bộ lát vòng và chấm chú giải ở tab Chung/Cache; giữ nhãn và số đếm để đọc không phụ thuộc màu. Sáu thẻ Chung xếp ba cột/hai hàng trên desktop và hai cột/ba hàng trên vùng hẹp; các tab riêng giữ bốn thẻ, giảm xuống hai cột, các panel biểu đồ xếp dọc trên vùng hẹp; bảng đối chiếu Chung giữ ba cột trên mobile, cho phép chữ xuống dòng trong ô để không tràn ngang. Bảng rộng cuộn trong vùng có nhãn và nhận focus bàn phím. Biểu đồ có tên/mô tả và số liệu dạng chữ; trạng thái không chỉ phân biệt bằng màu.

## Luồng tài liệu

1. Chọn danh mục mặc định, rồi chọn/thả một hoặc nhiều tệp.
2. Tệp hợp lệ vào danh sách ở trạng thái **Chờ tải lên**. Lỗi từng tệp được báo riêng; tệp hợp lệ khác vẫn được tiếp nhận.
3. Đổi phân loại từng dòng, tìm theo tên hoặc lọc danh mục. Bỏ một dòng chỉ bỏ tệp khỏi phiên giao diện, không xóa file gốc.
4. Khi chuyển về Chat rồi quay lại, danh sách và phân loại vẫn giữ. Reload xóa phiên.

Danh mục hiện có: Chưa phân loại, Nhân sự, Quy định, Kỹ thuật, Quy trình, Khác. Đây là nhãn sắp xếp, không phải role/quyền truy cập.

Bản giao diện nhận PDF, DOCX, TXT, MD theo đuôi tệp, giới hạn 20 MB/tệp, từ chối tệp trống. Chặn trùng bằng tên/kích thước/lastModified, không phải đối chiếu nội dung. Những kiểm tra này phục vụ UI; backend vẫn phải tự kiểm tra định dạng/nội dung, dung lượng, quyền và lưu trữ khi có API thật.

Hiện không đọc nội dung, parse, chunk, embed, upload hoặc lập chỉ mục tệp. Không có progress/success giả; danh sách ghi rõ tệp chưa lên hệ thống. Hợp đồng nạp và cơ chế phân quyền vẫn cần đặc tả trước khi thực thi.

## Tổ chức code

| Thư mục trong `frontend/` | Trách nhiệm |
| --- | --- |
| `src/app/` | Route, metadata và lắp ghép provider |
| `src/components/layout/` | Sidebar Chat/Số liệu/Tài liệu, drawer mobile, khung trang |
| `src/components/ui/` | Component React dùng chung, không gọi API/storage |
| `src/features/chat/` | Context giữ phiên, hook điều phối, reducer, UI và phản hồi mẫu tách riêng |
| `src/features/developer/` | Developer Workspace xem trước: fixture/reducer, hội thoại, diff/test/approval/trace mô phỏng |
| `src/features/metrics/` | Lọc/tổng hợp demo, thứ tự/đoạn đường theo truy vấn, biểu đồ và dashboard; không suy diễn telemetry/quyền |
| `src/features/documents/` | Model/validation/lọc, provider giữ File trong phiên và màn tài liệu |
| `src/features/setup/` | Trang thiết lập chín nhóm thông số và xuất cấu hình nháp |
| `src/features/experiment-config/` | Model/validation và provider giữ cấu hình thiết lập trong phiên; các profile/kế hoạch nghiên cứu cũ giữ riêng |
| `src/features/comparison/`, `experiments/`, `settings/` | Phần nghiên cứu đã hoãn, không nằm trong luồng app hiện tại |
| `src/features/ui-library/` | Catalog và mã ví dụ cho phát triển |
| `src/styles/` | Tokens, UI chung, layout, chat, metrics và documents |
| `scripts/` | Test state/validation và browser smoke |
| `design-reference/` | Bản xuất thiết kế gốc, không chạy script DOM trong app |

Bản gốc nằm tại [frontend/design-reference](../../frontend/design-reference/). Chế độ browser `--reference` chỉ sửa lỗi cú pháp `$$let` trong response preview để chụp ảnh, không sửa bản gốc. Bố cục app hiện tại gồm Workspace, Thiết lập, Chat, Số liệu và Tài liệu.

Đổi màu/font tại `styles/tokens.css`; đổi điều hướng tại `components/layout/AppShell.tsx`. Client API tương lai thuộc `src/lib/` theo [kiến trúc](../system/architecture.md), không đặt upload/RAG/auth vào component trình bày. Xem [hướng dẫn chạy và kiểm tra](../general/setup.md#kiểm-tra).
