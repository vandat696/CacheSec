# Thiết kế frontend

## Đã thống nhất

Ba màn hình; hai profile A/B có thể thay đổi, mặc định no cache và secure local cache.

## Giao diện đã tích hợp

Bộ thiết kế Nói được chuyển sang React/TypeScript trong Next.js App Router. Giữ hệ màu, font Segoe UI/system, khoảng cách, bề mặt vuông, control bo 8px, trạng thái disabled và reduced motion của bản xuất. Bản gốc được giữ nguyên tại [frontend/design-reference](../../frontend/design-reference/), không chạy các script DOM của bản xuất trong app.

Bản xuất có lỗi cú pháp `$$let` trong `app.js`; chế độ kiểm tra browser `--reference` chỉ sửa lỗi này trong response preview để chụp đối chiếu, không sửa file gốc. App React không phụ thuộc script đó.

| Route | Hiện có | Giới hạn |
| --- | --- | --- |
| `/` | Chat mô phỏng: gợi ý, gửi tin, trạng thái chờ, sao chép, lịch sử và bản nháp từng hội thoại | Chỉ bộ nhớ trong màn chat; không gọi model/API, không lưu browser storage |
| `/ui` | Thư viện 21 component: tìm kiếm, lọc nhóm, thử trạng thái, xem/sao chép mã React | Dữ liệu mẫu; không có kết quả benchmark hoặc cấu hình nghiệp vụ |

Khung dùng chung có sidebar responsive, breadcrumb, liên kết bỏ qua điều hướng, drawer mobile đóng bằng Escape và giữ focus trong drawer. Dialog/menu/tab hỗ trợ bàn phím; các control có nhãn và phản hồi validation. Mã và tin nhắn được hiển thị dưới dạng văn bản, không nhận HTML tùy ý.

Hai route này là nền giao diện. Ba màn hình nghiên cứu bên dưới vẫn là thiết kế dự kiến; chat mô phỏng không xác nhận đã triển khai RAG, multi-turn với model, cache hay phân quyền.

## Tổ chức code frontend

| Thư mục trong `frontend/` | Trách nhiệm |
| --- | --- |
| `src/app/` | Route, metadata và import stylesheet; page chỉ lắp ghép tính năng |
| `src/components/layout/` | Khung ứng dụng, điều hướng và drawer |
| `src/components/ui/` | Component React nhận props; dùng lại giữa các màn, không gọi API/storage |
| `src/features/chat/` | Màn chat, hook điều phối, reducer trạng thái và phản hồi mô phỏng tách riêng |
| `src/features/ui-library/` | Catalog, dữ liệu mẫu, mã ví dụ và phần thử component |
| `src/styles/` | Tokens, kiểu component, layout, chat và catalog tách theo trách nhiệm |
| `scripts/` | Test trạng thái hội thoại và kiểm tra browser local |
| `design-reference/` | Bản xuất HTML/CSS/JS và handoff để đối chiếu, không phải code runtime |

Đổi màu/font/radius/motion tại `src/styles/tokens.css`. Đổi cấu trúc app tại `components/layout/app-shell.tsx`; thêm route trong `app/` và mục điều hướng tương ứng. Khi cần biến thể UI, truyền props hoặc kết hợp các component; không cần kế thừa class hay tạo base component tổng quát.

Component dùng props TypeScript và event React thông thường. Ví dụ `Button` có `variant`, `loading`, `disabled`; `TextInput`/`NumberInput` nhận thuộc tính input HTML; `Switch`, `Slider`, `FlowDiagram` nhận giá trị và callback để màn sở hữu state. `Tabs`/`Dropdown` quản lý trạng thái tương tác nội bộ. `ToastProvider` được lắp một lần trong `AppShell`; `useToast()` dùng bên trong provider. `/ui` có mã tích hợp riêng cho từng component, bao gồm import và state cần thiết.

Logic chat nằm trong `chat-state.ts`, không phụ thuộc React/HTTP/storage. `use-chat.ts` quản lý tác vụ bất đồng bộ và hủy khi unmount; `demo-reply.ts` chỉ tạo văn bản mô phỏng. Khi có hợp đồng API thật, thêm client tại `src/lib/` theo [kiến trúc](../system/architecture.md), thay nguồn phản hồi ở hook và xử lý hợp đồng lỗi tương ứng. Không đưa fetch, xác minh quyền hoặc matching cache vào component UI.

Việc tích hợp không thêm dependency ứng dụng. Hướng dẫn chạy lint/typecheck/test/build và kiểm tra browser nằm tại [setup](../general/setup.md#kiểm-tra).

## So sánh chatbot

Một câu hỏi chung, hai khung riêng; cùng người dùng và điều kiện so sánh. Hiển thị cấu hình, câu trả lời, nguồn, latency, token, chi phí ước tính, quyền; cache có hit/miss/lý do, similarity, lookup/auth time.

Đề xuất câu hỏi độc lập trước. Multi-turn cần thiết kế cache có ngữ cảnh.

## Thí nghiệm và kết quả

Chọn workload/profile, số lượt, cold/warm; lưu từng lượt/cấu hình, biểu đồ và xuất JSON/CSV. Demo đồng thời khác benchmark.

## Cấu hình và quyền

Chọn thuật toán đã triển khai và tham số; người dùng, tenant, role, phòng ban, quyền tài liệu. Chưa cần editor code hoặc ngôn ngữ rule tùy ý. Profile không chứa secrets.

## Demo đề xuất

Hỏi khi có quyền → tạo cache → hỏi gần nghĩa → hit → thu hồi quyền → hỏi lại → chặn reuse → xem lịch sử.

## Cần chốt

Quản trị tối thiểu; streaming; multi-turn; đối chứng unsafe giả lập có cần không?
