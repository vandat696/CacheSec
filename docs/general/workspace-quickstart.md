# Hướng dẫn nhanh CacheSec Workspace

## Mở Workspace

Trên máy đã cài đặt CacheSec, mở Docker Desktop rồi chạy lệnh sau từ thư mục gốc của project.

```powershell
.\scripts\start-local.ps1
```

Workspace mở ở [cổng 3000](http://127.0.0.1:3000/workspace). Thêm `-Studio` nếu cần xem cơ sở dữ liệu. [Cài đặt và xử lý lỗi](setup.md#mở-toàn-bộ-stack-local-bằng-một-lệnh).

## Chạy kịch bản demo

Dùng project demo riêng có bản mã gốc, trước khi thêm `expiration_review`. Mã dev hiện đã có quy tắc này. [Chuẩn bị demo riêng](../system/context-comparison.md#demo-riêng).

1. Trên thanh Agent, giữ **Cả hai**. Mở **bánh răng → Model** và chọn **Gemini 3.5 Flash-Lite** để dùng model mặc định.
2. Trong **bánh răng → Cache**, chọn **Cold** để xóa cache trình duyệt trước lượt chạy. Gửi prompt dưới đây.
3. Khi cả hai nhánh kết thúc, chọn **Warm** và gửi lại cùng prompt. Giữ nguyên mã nguồn và model giữa hai lượt. **Warm** dùng cache sẵn có. **Preload** dùng khi bạn đã chuẩn bị cache riêng trước lượt chạy.

> Chỉ sửa `quotation_validation.py`. Trong `validate_quotation`, thêm đúng một cờ `expiration_review` cho `expires_on` nếu ngày hết hạn bị thiếu, sai định dạng, không tồn tại hoặc trước `reference_date`. Ngày hợp lệ có dạng `YYYY-MM-DD` và bằng hoặc sau `reference_date`. Giữ API và các tệp khác, rồi chạy bộ test hiện có.

## Xem bản sửa và cache hit

- Cuộn xuống dưới Workspace để xem **Không cache** và **Có Context Cache**. Dòng thêm có **`+` màu xanh**, dòng xóa có **`−` màu đỏ**. Bấm **Đến dòng sửa** để nhảy tới thay đổi đầu tiên.
- Ở nhánh **Có Context Cache**, **Miss** nghĩa là Agent đọc lại mã nguồn. **Verified Hit** nghĩa là backend đã kiểm tra quyền và phiên bản nguồn rồi cho dùng lại ngữ cảnh đã lưu. Agent vẫn gọi Gemini để tạo bản sửa cho lượt đó.
- Để xem ví dụ đã qua test, mở [phiên Warm đã lưu trên cổng 3100](http://127.0.0.1:3100/workspace?comparison=7811520c-68bf-4f66-b17e-b42fa0ac1c55) khi demo riêng đang chạy. Nếu chưa kết nối, chọn **Kết nối bằng token** và nhập `control_token` từ `backend/.local/comparison-demo-20261118/access.json`. Nút **đồng hồ** trên thanh Agent mở các phiên đã lưu.

## Lưu, duyệt hoặc xem lại mã gốc

- **Mở đề xuất trong editor → Lưu** để ghi bản sửa đã chọn vào project. Để đưa bản đã qua test lên app báo giá, chọn **Chạy ứng dụng** và phê duyệt đúng bản sửa trong hộp thoại.
- **Mở đề xuất trong editor → Thay đổi → Đưa mã gốc vào editor** để xem lại bản trước khi sửa. Bấm **Lưu** nếu cần ghi lại mã gốc và phiên của bạn có quyền ghi. [Chi tiết khôi phục](../system/context-comparison.md#về-mốc-ban-đầu).
