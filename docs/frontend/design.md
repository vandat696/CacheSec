# Thiết kế frontend

## Ưu tiên hiện tại

App có hai khu chính, theo yêu cầu ngày 2026-10-27:

- **Chat:** trao đổi với trợ lý nội bộ, lịch sử và chat mới.
- **Tài liệu:** chọn/thả tệp, phân loại và tìm/lọc danh sách.

Các màn A/B, thí nghiệm, profile/cache và thiết lập kỹ thuật để sau. Mã thử nghiệm trước đó được giữ riêng, không lắp vào luồng hiện tại. Không đưa model, matching, TTL, similarity hoặc seed ra cho người dùng ở bước này.

## Route và trạng thái thực tế

| Route | Giao diện | Giới hạn |
| --- | --- | --- |
| `/` | Chat nội bộ, lịch sử trong sidebar, gợi ý hỏi, gửi/sao chép và chat mới | Phản hồi mẫu; chưa gọi AI/RAG |
| `/documents` | Chọn nhiều tệp, kéo thả, danh mục khi thêm, đổi danh mục từng tệp, tìm tên/lọc/bỏ khỏi danh sách | Tệp chỉ trong bộ nhớ trình duyệt, chưa tải lên server hay được chatbot đọc |
| `/chat`, `/settings`, `/experiments` | Chuyển về Chat để giữ liên kết cũ | Không mở lại màn tham số/thí nghiệm |
| `/ui` | Thư viện 21 component, truy cập trực tiếp cho phát triển | Không có mục điều hướng trong app chính |

Chỉ có hai mục Chat và Tài liệu trên sidebar. Lịch sử chat dùng cùng sidebar, không tạo thêm cột điều hướng. Nhãn Mô phỏng ở đầu trang mở phần giới hạn; nội dung và hành động giữ ngắn, dùng hệ màu/font/border của Nói.

## Luồng chat

Chat → nhập/gửi câu hỏi → phản hồi mẫu → sao chép hoặc tạo chat mới. Gợi ý dùng tình huống công ty, không phải tác vụ viết bài chung. Phản hồi mẫu ghi rõ chưa nối AI hoặc kho tài liệu, không tự trả lời từ tên/nội dung tệp được chọn.

`ChatProvider` giữ hội thoại và bản nháp qua điều hướng trong phiên. Phản hồi đang chờ có thể hoàn tất khi người dùng mở Tài liệu; kết quả vẫn thuộc hội thoại gốc. Reload mất phiên; chưa lưu server hoặc browser storage. Hook điều phối vẫn tách khỏi reducer và UI, hủy tác vụ khi provider unmount.

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
