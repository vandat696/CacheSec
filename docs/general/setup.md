# Chạy môi trường phát triển

Yêu cầu: Node.js 20.9+ (đã kiểm tra máy hiện tại có Node 24), Python 3.12+, Docker Desktop với Linux Engine đang chạy. Frontend dùng npm; backend dùng venv/pip. Chạy các lệnh sau từ thư mục gốc, bằng PowerShell.

## 1. Database

```powershell
Copy-Item infra/.env.example infra/.env
# Sửa POSTGRES_PASSWORD trong infra/.env, không commit file này.
docker compose --env-file infra/.env -f infra/compose.yaml up -d
docker compose --env-file infra/.env -f infra/compose.yaml exec db psql -U cachesec -d cachesec -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Lệnh kiểm tra giả định tên user/database mặc định. Database chỉ mở cổng localhost. Volume giữ dữ liệu khi dừng container. init.sql chỉ chạy lúc tạo volume mới; không xóa volume để cập nhật cấu hình vì có thể mất dữ liệu.

## 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/health. OpenAPI UI: http://127.0.0.1:8000/docs.

Health chỉ xác nhận API process hoạt động, không kiểm tra database hoặc model. Chưa có database adapter, xác thực hoặc API nghiệp vụ. CORS chỉ cho phép frontend local, không thay thế phân quyền.

## 3. Frontend (terminal khác)

```powershell
cd frontend
npm ci
npm run dev
```

Mở http://127.0.0.1:3000 để dùng Chat, `/metrics` để xem Số liệu hoặc `/documents` để chọn/thả và phân loại tài liệu. Sidebar theo thứ tự Chat → Số liệu → Tài liệu. `/chat`, `/settings` và `/experiments` chuyển về Chat; `/ui` giữ thư viện component cho phát triển, không nằm trong điều hướng chính. Chưa gọi AI/upload backend; không cần API key. Xem [tổ chức frontend](../frontend/design.md#tổ-chức-code).

Thử luồng: Chat → gửi câu hỏi hoặc tạo chat mới → sang Tài liệu → chọn danh mục rồi chọn/thả tệp → đổi phân loại từng tệp → tìm/lọc danh sách → quay lại Chat. Hội thoại, bản nháp và tệp giữ qua điều hướng trong phiên, mất khi tải lại. Tệp luôn ghi Chờ tải lên: chưa gửi server, chưa parse/embed hoặc được chatbot đọc. Nhãn Mô phỏng đã được bỏ khỏi giao diện; giới hạn thực tế vẫn thể hiện qua phản hồi mẫu, trạng thái tệp và thông số chưa đo/chưa xác minh.

Trong sidebar, bấm **Chat** hoặc mũi tên cạnh đó để mở/thu gọn lịch sử và nút **Chat mới** ngay bên dưới. Mỗi lần mở hiện 5 hội thoại mới tạo nhất; **Hiển thị thêm** mở tiếp từng nhóm 5 khi còn lịch sử. Chọn hội thoại giữ bản nháp và chế độ, kể cả khi đang ở Tài liệu.

Trong Chat, nhấn icon bánh răng nhỏ **Cài đặt chat** ở góc phải thanh trên cùng để chọn Không cache, Cache hoặc Cả hai. Mở phiên hoặc tải lại mặc định Cả hai. Chế độ Cả hai có hai vùng hội thoại không viền và một ô nhập gửi cùng prompt sang cả hai; đổi chế độ giữ lịch sử từng nhánh và bản nháp. Khi đang chờ, nút đổi chế độ và Chat mới tạm khóa. Cả hai nhánh vẫn trả lời mẫu, nhánh Cache chưa thực hiện lưu/tìm/reuse cache hoặc tạo số đo. Reload mất chế độ và lịch sử trong phiên.

Trang **Số liệu** có ba tab **Chung / Không cache / Cache**, chỉ giữ bộ lọc hội thoại, tổng hợp mọi lượt gửi trong hội thoại đã chọn. Chung có các biểu đồ tổng quan và bảng đối chiếu bên dưới: Không cache bên trái, tiêu chí ở giữa, Cache bên phải; giá trị tốt hơn được in đậm/tô màu khi có phép đo tương đương; hai tab riêng chỉ có biểu đồ, chất lượng/quyền và các lượt chạy nhánh tương ứng. Biểu đồ đường ở Chung dùng số truy vấn làm trục ngang, chọn Độ trễ/lượt gọi/token và kéo thanh Truy vấn để xem hai nhánh từng lượt. Không có số đo thì không vẽ đường độ trễ; nhánh không chạy tạo khoảng trống. Dùng phím trái/phải hoặc Home/End để chuyển tab. Bấm câu hỏi trong bảng để mở năm thông số; bảng phân trang 8 lượt. Usage demo bằng 0 ở nhánh đã chạy, chưa có lượt là dấu gạch; thời gian, hit rate, chất lượng và quyền chưa có phép đo/nhãn. Trang dùng dữ liệu phiên Chat, cập nhật phản hồi đang chờ và mất khi reload; chưa phải benchmark.

## Hydration warning do trình duyệt sửa HTML

Nếu console báo hydration mismatch tại `RootLayout`/`<body>` hoặc `<div>` và diff có thuộc tính lạ như `__processed_…`, `bis_register`, `bis_skin_checked` hoặc class `mdl-js`, hãy kiểm tra extension hoặc công cụ chèn nội dung vào trang. Code ứng dụng không sinh các dấu này. Dòng trong stack là nơi React phát hiện DOM khác với markup dự kiến, chưa xác định được extension cụ thể chỉ từ dòng đó. [Next.js ghi nhận extension sửa HTML là một nguyên nhân hydration mismatch](https://nextjs.org/docs/messages/react-hydration-error).

1. Mở cùng địa chỉ app bằng profile Guest hoặc profile mới không có extension. Nếu dùng cửa sổ ẩn danh/InPrivate, kiểm tra rằng extension không được phép chạy trong cửa sổ đó.
2. Nếu profile sạch không có cảnh báo, trên profile thường mở `chrome://extensions`, `edge://extensions` hoặc `coccoc://extensions`, tắt lần lượt extension có quyền truy cập trang rồi tải lại để xác định thủ phạm. Giới hạn quyền chạy của extension đó trên địa chỉ phát triển đang dùng (`localhost` hoặc `127.0.0.1`), nếu extension hỗ trợ. Với VPN, ngắt kết nối VPN có thể vẫn để content script chạy; cần tắt tiện ích hoặc thu hẹp quyền truy cập trang.
3. Sau khi tắt hoặc giới hạn extension, nhấn `Ctrl+Shift+R` để tải lại. Nếu vẫn lỗi trên profile sạch, xem diff mới để tìm sai khác khác trong ứng dụng.

Đối chiếu trên bản dev ngày 2026-10-27: Chat và Tài liệu không có console error trên profile sạch; mô phỏng chèn thuộc tính trên trước hydration tái hiện cảnh báo; bỏ mô phỏng rồi tải lại Chat hết cảnh báo. Đọc manifest/source extension đã cài trong Cốc Cốc xác định 1ClickVPN Proxy for Chrome (ID `pphgdbgldlmicfdkhondlafkiomnelnk`) khớp ID trong `bis_register` và có script xử lý/chèn `bis_*`; eJOY AI Dictionary (ID `amfojhdiedpdnlijjbhjnhokbnohfdfb`) có content script thêm class `mdl-js` vào html. Cần tắt hoặc giới hạn cả hai rồi kiểm tra lại trên profile gặp lỗi; chưa kiểm chứng thao tác này trên profile cá nhân.

## Kiểm tra

Trong frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Các test dùng Node test runner và đọc TypeScript trực tiếp; dùng Node 24 như môi trường đã kiểm tra. Node có thể cảnh báo tự nhận dạng ES module cho file TypeScript; cảnh báo này không làm test thất bại.

Kiểm tra tương tác và responsive bằng Edge/Chrome headless (không thêm test framework):

```powershell
# Terminal 1, sau npm run build:
npm run start -- --port 3100
# Terminal 2, cùng thư mục frontend:
npm run test:browser
# Tùy chọn: thêm ảnh đối chiếu với bản thiết kế gốc:
npm run test:browser -- --reference
```

Script mặc định tìm Edge/Chrome tại đường dẫn Windows thông dụng. Nếu khác, đặt `BROWSER_PATH` tới executable; `APP_URL` đổi địa chỉ app (mặc định http://127.0.0.1:3100). Ảnh và profile trình duyệt tạm nằm trong `frontend/test-results/browser/`, được Git bỏ qua. Script chỉ đóng process trình duyệt do nó mở; không dùng profile cá nhân. Nếu môi trường chặn tạo process hoặc truy cập DevTools local, cần chạy ngoài sandbox đó.

Thanh nhập và nút Gửi nằm cùng hàng, có cùng thiết kế ở cả ba chế độ. Enter gửi; Shift+Enter xuống dòng. Ô nhập tự giãn khi viết dài và thu gọn sau gửi.

Nhấn **Thông số** ở góc phải (icon biểu đồ trên mobile) để chọn lượt gửi trong hội thoại hiện tại và xem năm trường ở hai cột Không cache/Cache. Mặc định là lượt mới nhất; câu gửi lại vẫn có mục riêng. Nhánh không chạy ghi Không chạy; demo chưa có hit/miss, thời gian hoặc quyết định quyền thật, lượt gọi/token LLM bằng 0 vì chưa gọi model. Đóng bằng Escape hoặc nút đóng.

Browser smoke kiểm tra cả ba chế độ Chat, ba tab Số liệu, Tài liệu và cửa sổ Thông số tại chín kích thước (72 bố cục), cùng chọn lượt mới nhất/cũ/trùng, nhánh không chạy, cập nhật đang chờ, không bịa số đo/quyền, ô nhập/Gửi cùng hàng, giãn nhiều dòng, prompt chung, lịch sử từng nhánh, chọn/thả tệp, từ chối tệp lỗi/trùng, phân loại, tìm/lọc, giữ phiên qua route, redirect và UI kit. Dashboard được kiểm tra chuyển tab bằng phím trái/phải/Home/End, giữ bộ lọc, bảng đối chiếu ba cột với tiêu chí ở giữa, bảng/biểu đồ/chi tiết đúng nhánh, ID không trùng, phân trang, hoàn tất phản hồi khi rời Chat và reset khi reload. Lịch sử sidebar được kiểm tra mở/thu gọn, 5 → 10 → toàn bộ, giữ bản nháp/chọn từ Tài liệu, mobile, bàn phím và giảm chuyển động. Tham số `--reference` chỉ chụp thêm bản xuất gốc để đối chiếu nền thiết kế, không dùng nó làm hợp đồng bố cục hiện tại.

Trong backend:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

Frontend dùng package-lock.json để cố định dependencies đã resolve. Python dùng requirements-dev.lock.txt chụp phiên bản môi trường Windows/Python 3.12 hiện tại; requirements-dev.txt mô tả dependencies trực tiếp để cập nhật có chủ đích. Chưa khóa môi trường nghiên cứu hoặc kiểm chứng đa nền tảng, chưa phải môi trường benchmark hoàn chỉnh.

Tài liệu tham khảo: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [FastAPI](https://fastapi.tiangolo.com/), [pgvector](https://github.com/pgvector/pgvector).

## Thành phần đã khởi tạo

- Frontend: Next.js App Router, TypeScript strict, CSS thuần, ESLint và npm lockfile; Chat nội bộ và tiếp nhận/phân loại tài liệu trong phiên trên hệ thiết kế Nói. Chưa có upload hoặc phản hồi AI thật.
- Backend: FastAPI, cấu hình CORS local qua Pydantic Settings, health endpoint; requirements runtime/dev và bản freeze dependencies cho môi trường đã cài.
- Database: Docker Compose với PostgreSQL 17 + pgvector 0.8.7, cổng chỉ bind localhost, persistent volume, init extension vector.
- Chưa có schema nghiệp vụ, database adapter/migration, authentication, LLM/embedding provider, cache hoặc tích hợp UI/API.
- Chưa thêm Dexie/model SDK vì chưa dùng tới; chưa chốt storage server cache.
