# Trạng thái dự án

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

Bước tiếp theo là T01 để chốt đầu vào cần thiết và T02–T04 để thiết kế contract, dữ liệu và control; lập trình bắt đầu từ T05 sau khi điều kiện liên quan được xác nhận. Chưa tạo module, fixture hoặc API mới trong đợt lập kế hoạch này. Việc upload/ingestion tài liệu nội bộ không còn là đầu việc bắt buộc trước PoC này.

## Lịch sử tổ chức tài liệu

Trước lần đổi bối cảnh, tài liệu đánh số và file rỗng đã được gom thành 9 file dưới general/system/frontend/evaluation. Ngày 2026-11-02 thêm một kế hoạch PoC làm nơi quản lý công việc tương lai; tài liệu chủ đề hiện có tiếp tục sở hữu yêu cầu/kiến trúc/đánh giá. Các mục 2026-10 ở trên là lịch sử, không mô tả ưu tiên hiện hành.
