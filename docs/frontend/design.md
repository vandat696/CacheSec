# Thiết kế frontend

## Ưu tiên hiện tại

App có hai khu chính, theo yêu cầu ngày 2026-10-27:

- **Chat:** trao đổi với trợ lý nội bộ, lịch sử, chat mới và chọn không cache/có cache/so sánh chia đôi qua nút bánh răng.
- **Tài liệu:** chọn/thả tệp, phân loại và tìm/lọc danh sách.

Theo yêu cầu bổ sung ngày 2026-10-27, so sánh hai nhánh được đặt ngay trong Chat với một ô nhập chung. Các màn thí nghiệm, editor profile/cache và thiết lập kỹ thuật vẫn để sau. Mã nghiên cứu trước đó được giữ riêng, không lắp vào luồng hiện tại. Không đưa model, matching, TTL, similarity hoặc seed ra cho người dùng ở bước này.

## Route và trạng thái thực tế

| Route | Giao diện | Giới hạn |
| --- | --- | --- |
| `/` | Chat nội bộ, lịch sử trong sidebar, gợi ý hỏi, gửi/sao chép, chat mới và ba chế độ qua nút bánh răng | Phản hồi mẫu; chưa gọi AI/RAG hoặc cache thật |
| `/documents` | Chọn nhiều tệp, kéo thả, danh mục khi thêm, đổi danh mục từng tệp, tìm tên/lọc/bỏ khỏi danh sách | Tệp chỉ trong bộ nhớ trình duyệt, chưa tải lên server hay được chatbot đọc |
| `/chat`, `/settings`, `/experiments` | Chuyển về Chat để giữ liên kết cũ | Không mở lại màn tham số/thí nghiệm |
| `/ui` | Thư viện 21 component, truy cập trực tiếp cho phát triển | Không có mục điều hướng trong app chính |

Chỉ có hai mục Chat và Tài liệu trên sidebar. Lịch sử chat dùng cùng sidebar, không tạo thêm cột điều hướng. Thanh đầu trang Chat giữ Thông số và cài đặt ở góc phải; đã bỏ nhãn Mô phỏng và phần giới hạn mở từ nhãn đó. Nội dung và hành động giữ ngắn, dùng hệ màu/font/border của Nói.

## Luồng chat

Chat → nhập/gửi câu hỏi → phản hồi mẫu → sao chép hoặc tạo chat mới. Gợi ý dùng tình huống công ty, không phải tác vụ viết bài chung. Phản hồi mẫu ghi rõ chưa nối AI hoặc kho tài liệu, không tự trả lời từ tên/nội dung tệp được chọn.

`ChatProvider` giữ hội thoại và bản nháp qua điều hướng trong phiên. Phản hồi đang chờ có thể hoàn tất khi người dùng mở Tài liệu; kết quả vẫn thuộc hội thoại gốc. Reload mất phiên; chưa lưu server hoặc browser storage. Hook điều phối vẫn tách khỏi reducer và UI, hủy tác vụ khi provider unmount.

### Ba chế độ chat

Icon bánh răng **Cài đặt chat** ở góc phải thanh trên cùng mở ba lựa chọn. Icon 16 px, nút không viền/nền với vùng bấm 32 px trên desktop (44 px trên thiết bị cảm ứng). Bỏ tiêu đề hiển thị “Chat nội bộ” và nhãn chế độ lặp để dành chỗ cho hội thoại; tên truy cập cho trình đọc màn hình vẫn được giữ.

- **Không cache** (mặc định): một khung hội thoại cho nhánh không cache.
- **Có cache**: một khung cho nhánh có cache; phản hồi mẫu nói rõ cache chưa triển khai.
- **So sánh chia đôi**: hai khung Không cache/Có cache đặt cạnh nhau, cuộn riêng, cùng một ô nhập và nút gửi bên dưới. Gửi một lần thêm cùng prompt vào hai nhánh và khởi chạy hai phản hồi mẫu song song; mỗi nhánh có trạng thái chờ/lỗi riêng. Giữ bố cục hai cột cả ở màn nhỏ với chữ/padding gọn hơn.

Hai vùng so sánh không có viền bao quanh, nền card hoặc đường kẻ tiêu đề; giữ nhãn nhỏ Không cache/Có cache và một vạch dọc 1 px màu viền chung nằm giữa khoảng cách hai cột. Vạch chạy hết chiều cao vùng hội thoại, dừng trước thanh nhập, không chặn thao tác chuột và chỉ hiện ở chế độ chia đôi, kể cả trên mobile. Giảm padding ngoài, bỏ nội dung chờ lặp ở hai vùng trống, nhãn Mô phỏng và tên vai trò lặp trên tin nhắn. Giữ giới hạn trong menu/phản hồi mẫu, trạng thái chờ/lỗi và thao tác sao chép. Hướng dẫn phím gửi dùng chữ ẩn cho trình đọc màn hình; placeholder và nút Gửi phục vụ thao tác chính.

Thanh nhập dùng cùng thiết kế và chiều rộng ở cả ba chế độ (tối đa 1120 px, co theo màn hình). Textarea và nút Gửi nằm cạnh nhau trong cùng một hàng có viền chung; nút bám cạnh dưới khi nhập nhiều dòng. Ô nhập cao tối thiểu 44 px, tự giãn đến 160 px rồi cuộn nội dung, thu gọn lại sau gửi và điều chỉnh theo bản nháp/chiều rộng màn hình. Enter gửi, Shift+Enter xuống dòng; thông báo nhập rỗng đặt dưới thanh để không đẩy nút Gửi sang hàng khác.

Chế độ, bản nháp và lịch sử hai nhánh thuộc từng hội thoại; đổi chế độ không xóa hoặc chuyển nội dung giữa hai nhánh. Khi vào so sánh sau các lượt chat đơn, mỗi bên tiếp tục lịch sử riêng đã có. Chat mới kế thừa chế độ đang chọn và bắt đầu với lịch sử rỗng. Đổi chế độ và tạo chat mới tạm khóa đến khi mọi nhánh của lượt gửi hoàn tất; vẫn có thể xem hội thoại khác hoặc mở Tài liệu.

Mỗi lượt có ID và danh sách nhánh đang chờ để bỏ qua phản hồi trùng, phản hồi của lượt cũ hoặc sai nhánh. Một nhánh lỗi không hủy kết quả nhánh còn lại. Hai nhánh hiện chỉ là mô phỏng UI, cùng độ trễ mô phỏng; chưa có lookup/reuse cache, xác minh quyền, hit/miss, số đo tốc độ/token/chi phí hoặc kết quả benchmark. Lựa chọn Có cache chưa chốt vị trí local/server.

### Thông số theo lượt gửi

Nút **Thông số** chỉ hiện icon biểu đồ trên cả desktop/mobile, giữ tên truy cập và tooltip Thông số. Icon này nằm ngay bên trái bánh răng cài đặt trong cùng một nhóm ở góc phải thanh trên cùng, cách nhau 4 px, vùng bấm 32 px trên desktop hoặc 44 px trên thiết bị cảm ứng. Nút mở một cửa sổ modal có hai cột Không cache/Có cache và vạch ngăn giữa. Escape hoặc nút đóng trả focus về nút mở; nội dung cửa sổ cuộn khi thiếu chiều cao.

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
| `src/components/layout/` | Sidebar hai mục, drawer mobile, khung trang |
| `src/components/ui/` | Component React dùng chung, không gọi API/storage |
| `src/features/chat/` | Context giữ phiên, hook điều phối, reducer, UI và phản hồi mẫu tách riêng |
| `src/features/documents/` | Model/validation/lọc, provider giữ File trong phiên và màn tài liệu |
| `src/features/comparison/`, `experiments/`, `settings/`, `workspace/` | Phần nghiên cứu đã hoãn, không nằm trong luồng app hiện tại |
| `src/features/ui-library/` | Catalog và mã ví dụ cho phát triển |
| `src/styles/` | Tokens, UI chung, layout, chat và documents |
| `scripts/` | Test state/validation và browser smoke |
| `design-reference/` | Bản xuất thiết kế gốc, không chạy script DOM trong app |

Bản gốc nằm tại [frontend/design-reference](../../frontend/design-reference/). Chế độ browser `--reference` chỉ sửa lỗi cú pháp `$$let` trong response preview để chụp ảnh, không sửa bản gốc. Bố cục app hiện tại ưu tiên hai khu theo yêu cầu mới.

Đổi màu/font tại `styles/tokens.css`; đổi điều hướng tại `components/layout/app-shell.tsx`. Client API tương lai thuộc `src/lib/` theo [kiến trúc](../system/architecture.md), không đặt upload/RAG/auth vào component trình bày. Xem [hướng dẫn chạy và kiểm tra](../general/setup.md#kiểm-tra).
