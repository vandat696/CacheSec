# Tổ chức source và quy ước đặt tên

Áp dụng từ refactor 2026-11-07. [AGENTS.md](../../AGENTS.md) chứa luật; tài liệu này là bản đồ source hiện tại. Tổ chức theo feature/domain và trách nhiệm, không áp một cây OOP cố định cho cả React và Python.

## Frontend

File component React dùng PascalCase khớp component chính (ChartFrame.tsx, AppShell.tsx); module nhóm component dùng tên nhóm PascalCase. File hook/helper/model/data TypeScript dùng camelCase (useField.ts, chartFormat.ts, chatState.ts), thư mục feature dùng kebab-case. Giữ tên entry/framework như index.ts, page.tsx và layout.tsx. TypeScript kiểm tra casing import nhất quán; tên JS DOM, bundle JS/CSS và Python giữ quy ước riêng, không đổi theo tên component React.

```text
frontend/src/
  app/                         route, metadata, composition provider
  components/
    layout/                    khung ứng dụng
    ui/
      forms/                   TextInput.tsx, NumberInput.tsx, Select.tsx...
      charts/                  LineChart.tsx, ChartFrame.tsx, chartFormat.ts...
      navigation/              Tabs.tsx, Dropdown.tsx
      feedback/                Badge.tsx, Alert.tsx, Dialog.tsx, ToastProvider.tsx
      data/                    DataTable.tsx, StatCard.tsx, ProgressBar.tsx
      diagrams/                FlowDiagram.tsx
      Button.tsx               component đơn lẻ đã có tên rõ
      CopyButton.tsx
      Icon.tsx
  features/
    developer/                 Workspace IDE mô phỏng
    quotations/                form/danh sách/chi tiết nối API, hook phiên và HTTP adapter
    experiment-config/         profile, comparison, experiment-plan, setup-plan
    ui-library/
      catalog/                 definition + snippet theo từng template
      previews/                tương tác demo theo từng template
      TemplatePreview.tsx      dispatch đến preview tương ứng
      UiLibrary.tsx            bố cục và bộ lọc catalog
```

experiment-config thay tên workspace cũ vì module đó giữ cấu hình thí nghiệm, không phải IDE. ExperimentConfigProvider/useExperimentConfig giữ state phiên; model thuần tách theo profile/comparison/plan/setup. Import .ts giữa các model cho phép Node test runner dùng cùng source; tsconfig cho phép extension này với noEmit.

Một file chứa component chính, props/helper cục bộ liên quan; helper dùng chung có file rõ tên trong cùng nhóm (Field/useField, ChartFrame/CartesianPlot/DonutPlot). Import trực tiếp module, ví dụ `@/components/ui/forms/Select`. Registry catalog chỉ lắp ghép definitions/previews, không chứa implementation. React giữ function component/hooks và composition; CSS app giữ selector/token hiện có.

Trong quotations: quotationModel.ts sở hữu wire types/draft và bảo toàn missing/null/raw; quotationApi.ts là adapter HTTP kiểm response/lỗi, nhận fetch qua constructor. useQuotations.ts quản lý request/abort/phiên trong bộ nhớ; QuotationConnection/Form/List/Details mỗi file một component, QuotationWorkspace chỉ lắp ghép. Form giữ body/key cho retry khi kết quả chưa rõ; không nhét token/nghiệp vụ vào AppShell hoặc route.

## Backend

Công cụ xem DB local ở frontend/prisma.config.ts và script npm db:studio để dùng lại npm workspace hiện có. Đây là dev tooling, không import vào React/backend; nó chọn QUOTATION_DATABASE_URL của app, còn SQL migrations bên dưới tiếp tục do Python sở hữu. Cách chạy và ranh giới quyền ở [setup](../general/setup.md#xem-database-bằng-prisma-studio).

```text
backend/app/
  control/
    control_api.py                             khởi tạo API control: /health, /ready
    control_settings.py                        cấu hình control
    health_routes.py                           các endpoint health/readiness
  shared/postgres_connection.py                PostgresDatabase, vòng đời connection
  quotation_demo/
    quotation_api.py                           nối config, quyền, DB, HTTP/CORS (--factory)
    quotation_settings.py                      cấu hình QUOTATION_ riêng
    migrate_quotations.py                       lệnh chạy migration báo giá
    api/
      quotation_http_app.py                    cấu hình FastAPI và ánh xạ lỗi HTTP
      quotation_routes.py                      endpoint tạo/danh sách/chi tiết
      quotation_responses.py                   model response/envelope HTTP
      quotation_request_middleware.py          cap body và request ID
      quotation_service_factory.py             tạo service gắn identity đã xác minh
    business/
      quotation_models.py                      QuotationCreate/Record/Page
      quotation_service.py                     thao tác nghiệp vụ, quyền và transaction
      quotation_permissions.py                 capability, caller, interface kiểm quyền
      quotation_repository_interface.py        interface lưu trữ/transaction, lỗi và retry
    auth/fixture_identity.py                   kiểm token/quyền fixture hiện tại
    database/
      postgres_quotation_repository.py          các truy vấn SQL báo giá
      postgres_quotation_transactions.py        commit/rollback và lỗi persistence
      quotation_migrations.py                  đọc/chạy SQL, history/checksum/lock
      migrations/001_create_quotations.sql       SQL đã version hóa
      migrations/002_creation_requests.sql      metadata idempotency
```

Luồng đọc code: quotation_routes nhận request → quotation_service kiểm quyền và điều phối → postgres_quotation_repository truy vấn SQL trong postgres_quotation_transactions → PostgreSQL. quotation_api chỉ nối các thành phần; quotation_http_app giữ cấu hình/response lỗi thuộc HTTP, tách khỏi nghiệp vụ. Hai phần tạo/cấp service cũ đã gom vào quotation_service_factory, gồm interface nhỏ và implementation fixture cùng trách nhiệm.

business không nhập api/database/auth/control, FastAPI hoặc Psycopg. Nó sở hữu các Protocol nhỏ cho quyền và lưu trữ/transaction. QuotationService nhận dependencies qua constructor, kiểm quyền trước mở transaction và chỉ trả thành công sau commit; adapter chuyển lỗi driver sang lỗi nghiệp vụ lưu trữ, không che lỗi lập trình. Repository nhận connection, không tự cấp quyền hoặc commit. Factory app không import control/Agent/cache. tests/control, tests/shared và tests/quotation_demo đi theo module sở hữu.

Đây là cách áp dụng OOP/SOLID theo trách nhiệm thực tế: capability port nhỏ, thay authority/storage qua composition, không kế thừa base class chung. Test double và PostgreSQL cùng được kiểm tra commit/rollback/retry; fake không được giả thành công khi contract yêu cầu lỗi. Không tạo interface cho từng function hoặc tầng service/controller rỗng.

OOP dùng cho đối tượng có trạng thái/phụ thuộc; logic thuần giữ function. Điểm khởi động đặt theo ứng dụng, không bắt buộc main.py. Từ refactor ngày 2026-11-09: control chạy uvicorn app.control.control_api:app, báo giá chạy uvicorn app.quotation_demo.quotation_api:create_app --factory, migration chạy python -m app.quotation_demo.migrate_quotations. Các path import/CLI cũ được thay bằng tên mới, không giữ module alias làm khó phân biệt. HTTP route, env QUOTATION_, schema và định danh/bytes/checksum SQL giữ nguyên; schema mới dùng migration forward.

## UI template tham chiếu

React dùng components/ui; JS DOM độc lập dùng design-reference/templates/src. Hai implementation theo host, catalog/demo tách khỏi implementation.

| Muốn sửa | Mở file dưới frontend/ |
| --- | --- |
| Select React | src/components/ui/forms/Select.tsx |
| Ví dụ/options Select | src/features/ui-library/catalog/select.ts |
| Preview tương tác Select | src/features/ui-library/previews/SelectPreview.tsx |
| Select JS element/destroy | design-reference/templates/src/controls/select.js |
| Lifecycle DOM | design-reference/templates/src/core/lifecycle.js |
| Catalog JS | design-reference/catalog/data.js và page.js |
| Shell/chat minh họa | design-reference/demo-shell.js |
| Prototype cũ, không tải trong index | design-reference/legacy/extended-kit-prototype.js |

manifest.json khai báo source từng template và thứ tự bundle. Sửa source rồi chạy npm run templates:build; templates:check phát hiện bundle lệch source. components.js là bundle sinh tự động để giữ script defer và API NoiUI v2.0.0, không sửa tay; app nhúng không cần TypeScript/catalog. CSS template được định dạng dễ đọc, giữ thứ tự cascade. Lỗi có sẵn $$let đã sửa trong demo-shell; browser smoke phục vụ file thật, không vá response.

[Hướng dẫn template](../../frontend/design-reference/templates/README.md) sở hữu cách nhúng; [setup](../general/setup.md#kiểm-tra) sở hữu kiểm chứng. Khi đổi path phải cập nhật imports, snippets, test, manifest/script và link docs cùng lúc, không đổi hành vi hoặc dữ liệu nghiên cứu chỉ để thay cấu trúc.
