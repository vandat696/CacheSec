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

Mở http://127.0.0.1:3000 để dùng Chat, hoặc `/documents` để chọn/thả và phân loại tài liệu. Sidebar chỉ có hai khu này. `/chat`, `/settings` và `/experiments` chuyển về Chat; `/ui` giữ thư viện component cho phát triển, không nằm trong điều hướng chính. Chưa gọi AI/upload backend; không cần API key. Xem [tổ chức frontend](../frontend/design.md#tổ-chức-code).

Thử luồng: Chat → gửi câu hỏi hoặc tạo chat mới → sang Tài liệu → chọn danh mục rồi chọn/thả tệp → đổi phân loại từng tệp → tìm/lọc danh sách → quay lại Chat. Hội thoại, bản nháp và tệp giữ qua điều hướng trong phiên, mất khi tải lại. Tệp luôn ghi Chờ tải lên: chưa gửi server, chưa parse/embed hoặc được chatbot đọc. Mở nhãn Mô phỏng để xem giới hạn.

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

Browser smoke kiểm tra Chat/Tài liệu tại chín kích thước, cùng chọn/thả tệp, từ chối tệp lỗi/trùng, phân loại, tìm/lọc, giữ phiên qua route, redirect và UI kit. Tham số `--reference` chỉ chụp thêm bản xuất gốc để đối chiếu nền thiết kế, không dùng nó làm hợp đồng bố cục hiện tại.

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
