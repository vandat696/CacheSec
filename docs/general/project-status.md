# Trạng thái dự án

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

## Định hướng và việc còn mở

### Định hướng đã thống nhất

- Secure local semantic cache là trọng tâm, none/server là đối chiếu.
- Giao diện hiện tại gồm Thiết lập → Chat → Số liệu → Tài liệu theo [thiết kế frontend](../frontend/design.md). Chat có ba chế độ Không cache/Cache/Cả hai, mặc định Cả hai với prompt chung; Số liệu mặc định xem fixture, không có công tắc/mô tả nguồn trên toolbar. Nguồn phiên Chat chưa có số đo/đánh giá thật vẫn tách riêng qua URL cho phát triển/kiểm thử. Thiết lập thí nghiệm nháp đã có tại `/setup`; runner và benchmark vẫn hoãn đến sau nền tảng chat/tài liệu.
- Next.js, FastAPI/Python, PostgreSQL/pgvector, browser IndexedDB/Dexie.
- API model trước, local/fine-tune sau; tách LLM/embedding.
- Tách storage/matching/validation, tránh abstraction quá mức.
- Frontend Chat/Số liệu/Tài liệu mô phỏng và backend health đã có; upload/ingestion, xác thực, phân quyền, RAG/model và cache thật vẫn chưa triển khai.

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
