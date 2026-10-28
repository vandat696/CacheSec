# Thiết kế frontend

## Ưu tiên hiện tại

App có ba khu chính, theo yêu cầu ngày 2026-10-27 và bổ sung ngày 2026-10-28:

- **Chat:** trao đổi với trợ lý nội bộ, lịch sử, chat mới và chọn không cache/có cache/so sánh chia đôi qua nút bánh răng.
- **Số liệu:** dashboard trực quan bám các tiêu chí đánh giá đồ án, ngay sau Chat và trước Tài liệu.
- **Tài liệu:** chọn/thả tệp, phân loại và tìm/lọc danh sách.

Theo yêu cầu bổ sung ngày 2026-10-27, so sánh hai nhánh được đặt ngay trong Chat với một ô nhập chung. Các màn thí nghiệm, editor profile/cache và thiết lập kỹ thuật vẫn để sau. Mã nghiên cứu trước đó được giữ riêng, không lắp vào luồng hiện tại. Không đưa model, matching, TTL, similarity hoặc seed ra cho người dùng ở bước này.

## Route và trạng thái thực tế

| Route | Giao diện | Giới hạn |
| --- | --- | --- |
| `/` | Chat nội bộ, lịch sử trong sidebar, gợi ý hỏi, gửi/sao chép, chat mới và ba chế độ qua nút bánh răng | Phản hồi mẫu; chưa gọi AI/RAG hoặc cache thật |
| `/metrics` | Dashboard, lọc hội thoại, biểu đồ, đánh giá chất lượng/quyền và chi tiết lượt gửi | Tổng hợp phiên mô phỏng; chưa có telemetry hoặc nhãn đánh giá thật |
| `/documents` | Chọn nhiều tệp, kéo thả, danh mục khi thêm, đổi danh mục từng tệp, tìm tên/lọc/bỏ khỏi danh sách | Tệp chỉ trong bộ nhớ trình duyệt, chưa tải lên server hay được chatbot đọc |
| `/chat`, `/settings`, `/experiments` | Chuyển về Chat để giữ liên kết cũ | Không mở lại màn tham số/thí nghiệm |
| `/ui` | Thư viện 21 component, truy cập trực tiếp cho phát triển | Không có mục điều hướng trong app chính |

Sidebar theo thứ tự Chat → Số liệu → Tài liệu. Lịch sử chat dùng cùng sidebar, không tạo thêm cột điều hướng. Thanh đầu trang Chat giữ Thông số và cài đặt ở góc phải; đã bỏ nhãn Mô phỏng và phần giới hạn mở từ nhãn đó. Nội dung và hành động giữ ngắn, dùng hệ màu/font/border của Nói.

Lịch sử và nút Chat mới nằm lồng ngay dưới mục Chat, trước Số liệu. Mặc định thu gọn; bấm Chat hoặc mũi tên để mở/đóng với hiệu ứng chiều cao và độ mờ (tắt khi giảm chuyển động). Mỗi lần mở hiện 5 hội thoại đầu danh sách, theo thứ tự mới tạo trước; **Hiển thị thêm** mở tiếp từng nhóm 5 và ẩn khi hết. Hội thoại đang chọn được tô nền, tên dài rút gọn bằng dấu ba chấm. Có thể chọn lịch sử từ Số liệu/Tài liệu để trở về đúng hội thoại; giữ bản nháp và chế độ. Trên điện thoại, mở lịch sử giữ drawer để chọn; chọn hội thoại/Chat mới đóng drawer. Nội dung thu gọn không nhận focus hoặc xuất hiện với trình đọc màn hình; nút mũi tên hỗ trợ bàn phím và báo trạng thái mở/đóng.

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

Trang `/metrics` mở trực tiếp từ sidebar, dùng cùng `ChatProvider` và cập nhật khi phản hồi về dù đang rời Chat. Thanh tab **Chung**, **Không cache**, **Cache** nằm đầu nội dung trang, trước bộ lọc dùng chung, mặc định Chung. Bỏ tiêu đề hiển thị Số liệu, nhãn Phiên hiện tại và câu mô tả ở đầu; giữ tên trang ẩn cho trình đọc màn hình. Dùng component Tabs hiện có, hỗ trợ phím trái/phải, Home/End; chỉ panel đang chọn xuất hiện và nhận focus. Chuyển tab giữ bộ lọc hội thoại; mỗi tab có biểu đồ, phân trang và chi tiết riêng, đổi bộ lọc đưa bảng về trang đầu và đóng chi tiết.

Chỉ giữ bộ lọc tất cả hoặc một hội thoại; bỏ ô Lượt gửi, tổng hợp mọi lượt gửi trong hội thoại đã chọn. Tab Chung đếm mỗi lượt chia đôi một lần, giữ hai kết quả nhánh; prompt trùng vẫn giữ ID riêng. Tab nhánh chỉ đếm và liệt kê lượt thực sự chạy nhánh đó, bao gồm lượt chia đôi, đang chờ và lỗi. Không gán usage 0 cho nhánh không chạy. Không có bộ lọc ngày, tenant, cold/warm hay local/server giả khi chưa có dữ liệu tương ứng.

Nội dung bám [tiêu chí đánh giá](../evaluation/design.md), không thêm thống kê người dùng, doanh thu hoặc vận hành không liên quan:

- **Chung:** sáu thẻ theo thứ tự Total Queries (Tổng số câu hỏi), Safe Cache Hit Rate (Tỷ lệ sử dụng cache hợp lệ), Latency Reduction (Thời gian phản hồi giảm), LLM Calls Saved (Số lượt gọi LLM tiết kiệm), Tokens Saved (Số token LLM tiết kiệm), Security Violations (Lượt trả cache trái quyền); biểu đồ đường hiệu suất theo số truy vấn và kết quả cache ở phía trên. Bên dưới là **bảng ba cột Không cache / Tiêu chí / Cache**: tên chỉ số chỉ xuất hiện ở giữa, hai giá trị căn cùng hàng ở hai bên. Chỉ có một hàng Độ trễ; giữ calls, token, cache status, quyền, chất lượng, semantic false hit, disclosure và false denial (9 hàng). Dashboard không hiển thị Chi phí hoặc P50/P95. Tiêu đề chỉ có Không cache / Tiêu chí / Cache, bỏ số lượt chạy. Thanh trạng thái ở dưới không kèm dòng đếm hoàn tất/đang chờ/lỗi hoặc ghi chú phản hồi mẫu/timeout. Bỏ tiêu đề hiển thị và dòng mô tả phía trên bảng; panel bắt đầu ngay bằng bảng, giữ tên vùng cho trình đọc màn hình.
- **Không cache:** thẻ độ trễ, calls, token, disclosure; biểu đồ hiệu năng chỉ có baseline, trạng thái phản hồi và chất lượng/phân quyền của baseline. Bỏ khối tổng lượt gọi LLM và ghi chú dưới biểu đồ hiệu năng ở cả hai tab riêng. Không đưa biểu đồ hit/miss hoặc đánh giá semantic false hit vào tab này.
- **Cache:** cùng nhóm thẻ/hiệu năng của nhánh cache, thêm vòng Hit/Miss/Rejected, semantic false hit, chất lượng/phân quyền và trạng thái phản hồi cache. Không vẽ baseline trong biểu đồ hoặc cột thông số.
- Thời gian chưa đo dùng khung rỗng; usage demo bằng 0 khi nhánh đã chạy, chưa có lượt thì dùng dấu gạch. Vòng cache trung tính, không vẽ lát cắt hoặc gán tỷ lệ 0% giả; chỉ có hit sau xác minh quyền/tính hợp lệ. Chất lượng/quyền chưa chấm/chưa kiểm thử, không suy ra ALLOW/DENY từ hoàn tất hoặc lỗi.
- Thanh chồng hoàn tất/đang chờ/lỗi tính trên các phản hồi nhánh đã chạy, kể cả lỗi; nhãn truy cập vẫn có số đếm, bỏ dòng đếm và ghi chú hiển thị dưới thanh. Đây là trạng thái demo, không phải chất lượng; timeout chưa có phép đo.
- Cả ba tab có bảng lượt gửi phân trang 8 lượt. Tab Chung có cả hai cột nhánh và đủ hai bộ thông số; tab riêng chỉ có cột/kết quả của nhánh tương ứng. Bấm câu hỏi mở năm thông số dùng lại model Chat và hiển thị lỗi nếu có. ID bảng/biểu đồ/chi tiết riêng từng panel, không trùng khi cả ba tab cùng giữ state.

Biểu đồ **Hiệu suất theo số truy vấn** thay biểu đồ thanh tổng hợp trong tab Chung. Trục X là số truy vấn tăng dần trong bộ lọc, không phải giờ/phút; trục Y chọn Độ trễ (ms), Lượt gọi LLM hoặc Token LLM theo từng truy vấn, không phải tổng tích lũy. Hai đường Không cache/Cache giữ màu nhất quán, Cache nét đứt. Mỗi lượt Cả hai chỉ chiếm một vị trí X; prompt trùng, lượt đang chờ/lỗi vẫn có vị trí riêng. `ChatTurn.sequence` giữ thứ tự gửi chung trong phiên, độc lập thứ tự tạo hội thoại hoặc hoàn tất phản hồi; bảng chi tiết vẫn nhóm theo hội thoại như trước. Lọc một hội thoại đánh lại trục X từ 1 theo thứ tự gửi của hội thoại đó.

Thanh chọn Truy vấn mặc định theo lượt mới nhất; chọn bằng chuột/cảm ứng hoặc phím mũi tên để đọc hai giá trị. Đổi bộ lọc đưa biểu đồ về Độ trễ và lượt gần nhất; đổi tab giữ lựa chọn. Không có lượt thì khóa thanh chọn. Thiếu số đo, nhánh không chạy, NaN/Infinity hoặc giá trị âm tạo khoảng trống, không nối đường qua khoảng đó hoặc biến thành 0. Thời gian phản hồi mẫu không dùng làm độ trễ; demo chỉ vẽ usage 0 ở các nhánh thực sự chạy. Khi chưa có số đo độ trễ, giữ trục số truy vấn và ghi Chưa có số đo. Chưa thêm telemetry, timestamp, schema API, phép tính mức giảm hay kết quả benchmark; biểu đồ demo không chứng minh lợi ích khi cache ấm.

Sáu thẻ tổng quan chỉ thuộc tab Chung. Bỏ dòng tổng lượt gửi/lượt có cả hai nhánh phía trên thẻ; số câu hỏi chỉ hiển thị tại Total Queries. Total Queries lấy số lượt gửi trong phạm vi hội thoại đã lọc: một lượt gửi Cả hai chỉ tính một câu, gửi lại cùng prompt vẫn là lượt mới, giữ cả lượt đang chờ/lỗi. Năm chỉ số còn lại ghi — với tooltip Chưa đo khi chưa có telemetry/nhãn quyền đáng tin cậy. Không trừ usage demo 0 để tạo tiết kiệm, không gán hit rate hoặc Security Violations bằng 0 từ phản hồi mẫu/lỗi/DENY. Security Violations ở đây chỉ lượt trả cache trái quyền, chưa phải tổng disclosure của toàn bộ RAG. Công thức, mẫu số, đơn vị mức giảm và cách xác nhận vi phạm vẫn cần đặc tả khi có backend; chưa thêm API hoặc số đo thật.

Trong bảng đối chiếu, giá trị tốt hơn được in đậm, chữ xanh lá và nền xanh nhạt, kèm nhãn ẩn Tốt hơn cho trình đọc màn hình. Độ trễ, calls/token, disclosure và false denial ưu tiên thấp hơn; điểm chất lượng ưu tiên cao hơn. Chỉ so sánh khi cả hai số hữu hạn, không âm và đã xác lập điều kiện đo tương đương. Bằng nhau, thiếu dữ liệu, phép đo không tương đương hoặc trạng thái phân loại (cache/quyền) không có bên thắng. Độ trễ hiện ghi Chưa đo, chưa chọn cách tổng hợp khi chưa có telemetry. Demo hiện chưa có cặp đo AI/cache tương đương nên không tô bên thắng, kể cả usage 0; đây là model trình bày, không phải schema telemetry/API hay quyết định quyền.

Bỏ dòng thông báo nguồn phản hồi mẫu ở đầu dashboard; các giá trị chưa đo/chưa chấm/chưa xác minh vẫn hiển thị đúng tại từng chỉ số. Reload mất dữ liệu phiên. Chưa có kết quả đo, nhãn đánh giá, runner, lưu run hoặc schema telemetry/API. Demo hai nhánh không thay benchmark; cần cặp đo tương đương, tách cold/warm và vị trí/scope cache khi nối phép đo thật. Chưa chốt thêm công thức thống kê, rubric hay chính sách bảo mật.

Giữ tokens Nói, nền trắng/viền trung tính, hai màu nhất quán cho baseline/cache. Sáu thẻ Chung xếp ba cột/hai hàng trên desktop và hai cột/ba hàng trên vùng hẹp; các tab riêng giữ bốn thẻ, giảm xuống hai cột, các panel biểu đồ xếp dọc trên vùng hẹp; bảng đối chiếu Chung giữ ba cột trên mobile, cho phép chữ xuống dòng trong ô để không tràn ngang. Bảng rộng cuộn trong vùng có nhãn và nhận focus bàn phím. Biểu đồ có tên/mô tả và số liệu dạng chữ; trạng thái không chỉ phân biệt bằng màu.

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
| `src/features/metrics/` | Lọc/tổng hợp demo, thứ tự/đoạn đường theo truy vấn, biểu đồ và dashboard; không suy diễn telemetry/quyền |
| `src/features/documents/` | Model/validation/lọc, provider giữ File trong phiên và màn tài liệu |
| `src/features/comparison/`, `experiments/`, `settings/`, `workspace/` | Phần nghiên cứu đã hoãn, không nằm trong luồng app hiện tại |
| `src/features/ui-library/` | Catalog và mã ví dụ cho phát triển |
| `src/styles/` | Tokens, UI chung, layout, chat, metrics và documents |
| `scripts/` | Test state/validation và browser smoke |
| `design-reference/` | Bản xuất thiết kế gốc, không chạy script DOM trong app |

Bản gốc nằm tại [frontend/design-reference](../../frontend/design-reference/). Chế độ browser `--reference` chỉ sửa lỗi cú pháp `$$let` trong response preview để chụp ảnh, không sửa bản gốc. Bố cục app hiện tại gồm Chat, Số liệu và Tài liệu theo yêu cầu mới.

Đổi màu/font tại `styles/tokens.css`; đổi điều hướng tại `components/layout/app-shell.tsx`. Client API tương lai thuộc `src/lib/` theo [kiến trúc](../system/architecture.md), không đặt upload/RAG/auth vào component trình bày. Xem [hướng dẫn chạy và kiểm tra](../general/setup.md#kiểm-tra).
