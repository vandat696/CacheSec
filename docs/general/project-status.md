# Trạng thái dự án

Các mốc ngày tháng bên dưới là lịch sử tại thời điểm thực hiện; mục mới hơn thay thế định hướng cũ khi có thay đổi. Phạm vi và bước tiếp theo hiện hành được tổng hợp ở cuối file.

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

## Định hướng và việc còn mở

### Định hướng đã thống nhất

- Secure local semantic cache là trọng tâm, none/server là đối chiếu.
- Giao diện hiện tại gồm Chat nội bộ và Tài liệu theo [thiết kế frontend](../frontend/design.md). Chat có ba chế độ không cache/có cache/so sánh chia đôi bằng prompt chung, hiện chỉ mô phỏng. Runner, benchmark, editor profile và thiết lập kỹ thuật được hoãn đến sau nền tảng chat/tài liệu.
- Next.js, FastAPI/Python, PostgreSQL/pgvector, browser IndexedDB/Dexie.
- API model trước, local/fine-tune sau; tách LLM/embedding.
- Tách storage/matching/validation, tránh abstraction quá mức.
- Frontend Chat/Tài liệu mô phỏng và backend health đã có; upload/ingestion, xác thực, phân quyền, RAG/model và cache thật vẫn chưa triển khai.

### Còn mở

| Chủ đề | Cần quyết định | Tài liệu |
| --- | --- | --- |
| Tài liệu/baseline | API upload/ingestion, lưu trữ, giới hạn tệp, streaming, multi-turn và quản trị tối thiểu | [Frontend](../frontend/design.md), [kiến trúc](../system/architecture.md) |
| Quyền cho baseline | Nguồn identity/tenant, quyền nạp/đọc, RBAC/ABAC và threat model | [Phân quyền](../system/authorization.md) |
| AI | Provider/model, embedding, nơi chạy | [Kiến trúc](../system/architecture.md) |
| Cache, sau baseline | Server storage, metadata tin cậy, toàn vẹn, offline, metric/ngưỡng, TTL, eviction, schema và scope | [Cache](../system/cache.md), [phân quyền](../system/authorization.md) |
| Đánh giá, sau baseline | Dataset/nhãn, số lượt, công thức, thống kê và lưu profile/kết quả | [Đánh giá](../evaluation/design.md), [kiến trúc](../system/architecture.md) |


## Thứ tự tiếp theo đề xuất

1. Chốt hợp đồng upload/ingestion, lưu trữ và giới hạn tệp cùng nguồn identity/tenant, quyền nạp/đọc và threat model cho baseline.
2. Nối Chat/Tài liệu với backend để có upload/ingestion và chatbot RAG baseline thật, kiểm thử phân quyền tương ứng.
3. Sau nền tảng baseline, chốt metadata/policy cache, workload, nhãn và cách đo; bổ sung cache adapter cùng kiểm thử quyền/invalidation.
4. Nối hai nhánh so sánh với baseline/cache thật, triển khai runner và benchmark theo [thiết kế đánh giá](../evaluation/design.md) trước khi kết luận.

Quyết định mới ghi nội dung, lý do, lựa chọn cân nhắc và ảnh hưởng đến so sánh; chi tiết giữ tại tài liệu chủ đề, không lặp lại ở nhiều nơi.

## Cập nhật tài liệu

Đã gom tài liệu đánh số và các file rỗng vào 9 file trong cấu trúc general/system/frontend/evaluation. Giữ nội dung thiết kế, trạng thái và hướng dẫn chạy; không thay đổi code ứng dụng. Đã kiểm tra liên kết nội bộ, tham chiếu đường dẫn cũ và whitespace.
