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

Mở http://127.0.0.1:3000. Trang hiện chỉ xác nhận scaffold, chưa tự gọi backend, chưa có chat/cache. Không cần API key ở bước này.

## Kiểm tra

Trong frontend: npm run lint, npm run typecheck, npm run build.

Trong backend:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

Frontend dùng package-lock.json để cố định dependencies đã resolve. Python dùng requirements-dev.lock.txt chụp phiên bản môi trường Windows/Python 3.12 hiện tại; requirements-dev.txt mô tả dependencies trực tiếp để cập nhật có chủ đích. Chưa khóa môi trường nghiên cứu hoặc kiểm chứng đa nền tảng, chưa phải môi trường benchmark hoàn chỉnh.

Tài liệu tham khảo: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [FastAPI](https://fastapi.tiangolo.com/), [pgvector](https://github.com/pgvector/pgvector).

## Thành phần đã khởi tạo

- Frontend: Next.js App Router, TypeScript strict, CSS thuần, ESLint và npm lockfile. Trang scaffold không có dữ liệu nghiên cứu giả hoặc chức năng chat.
- Backend: FastAPI, cấu hình CORS local qua Pydantic Settings, health endpoint; requirements runtime/dev và bản freeze dependencies cho môi trường đã cài.
- Database: Docker Compose với PostgreSQL 17 + pgvector 0.8.7, cổng chỉ bind localhost, persistent volume, init extension vector.
- Chưa có schema nghiệp vụ, database adapter/migration, authentication, LLM/embedding provider, cache hoặc tích hợp UI/API.
- Chưa thêm Dexie/model SDK vì chưa dùng tới; chưa chốt storage server cache.
