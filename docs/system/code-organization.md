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
    experiment-config/         profile, comparison, experiment-plan, setup-plan
    ui-library/
      catalog/                 definition + snippet theo từng template
      previews/                tương tác demo theo từng template
      TemplatePreview.tsx      dispatch đến preview tương ứng
      UiLibrary.tsx            bố cục và bộ lọc catalog
```

experiment-config thay tên workspace cũ vì module đó giữ cấu hình thí nghiệm, không phải IDE. ExperimentConfigProvider/useExperimentConfig giữ state phiên; model thuần tách theo profile/comparison/plan/setup. Import .ts giữa các model cho phép Node test runner dùng cùng source; tsconfig cho phép extension này với noEmit.

Một file chứa component chính, props/helper cục bộ liên quan; helper dùng chung có file rõ tên trong cùng nhóm (Field/useField, ChartFrame/CartesianPlot/DonutPlot). Import trực tiếp module, ví dụ `@/components/ui/forms/Select`. Registry catalog chỉ lắp ghép definitions/previews, không chứa implementation. React giữ function component/hooks và composition; CSS app giữ selector/token hiện có.

## Backend

```text
backend/app/
  main.py                                      ASGI composition root
  control/
    settings.py                                cấu hình control
    health.py                                  router operational + response contracts
  shared/postgres.py                           PostgresDatabase, connection lifecycle
  quotation_demo/
    main.py                                    composition root API riêng (--factory)
    settings.py                                cấu hình QUOTATION_ riêng
    domain/quotation.py                        QuotationCreate/Record/Page
    application/
      quotation_service.py                     use cases, quyền, transaction boundary
      quotation_access.py                      capability và port quyền
      quotation_repository.py                  ports repository/session, lỗi và retry identity
    identity/fixture_registry.py               authority fixture, grant/revoke trong process
    http/
      application.py                           lắp router/middleware và ánh xạ lỗi
      router.py                                HTTP input/output và Bearer dependency
      contracts.py                             envelope/list response
      request_context.py                       request ID, cap body bytes
      service_provider.py                      port cấp service theo credential
      fixture_service_provider.py              ghép identity + session + service
    persistence/
      postgres_quotation_repository.py          PostgresQuotationRepository
      postgres_quotation_sessions.py            commit/rollback và lỗi persistence
      migrations.py                            history/checksum/transaction/lock
      sql/001_create_quotations.sql              SQL đã version hóa
      sql/002_creation_requests.sql              metadata idempotency riêng bảng báo giá
    migrate.py                                 CLI composition root
```

Domain không nhập persistence/HTTP/control. Application sở hữu các Protocol nhỏ cho quyền và repository/session, không nhập FastAPI/Psycopg. QuotationService nhận dependencies qua constructor, kiểm quyền trước mở session và chỉ trả thành công sau commit; adapter session chuyển lỗi driver sang lỗi port, không che lỗi lập trình. Repository nhận connection, không tự cấp quyền hoặc commit. HTTP chỉ xử lý giao thức/ánh xạ lỗi; factory app ghép implementations, không import control/Agent/cache. tests/control, tests/shared và tests/quotation_demo đi theo module sở hữu.

Đây là cách áp dụng OOP/SOLID theo trách nhiệm thực tế: capability port nhỏ, thay authority/storage qua composition, không kế thừa base class chung. Test double và PostgreSQL cùng được kiểm tra commit/rollback/retry; fake không được giả thành công khi contract yêu cầu lỗi. Không tạo interface cho từng function hoặc tầng service/controller rỗng.

OOP dùng cho đối tượng có trạng thái/phụ thuộc; logic thuần giữ function. Đóng gói và hướng phụ thuộc quan trọng hơn số class hoặc tầng kế thừa. Giữ lệnh uvicorn app.main:app, python -m app.quotation_demo.migrate; app có lệnh uvicorn app.quotation_demo.main:create_app --factory riêng. Không đổi /health, /ready hoặc checksum migration đã áp dụng; schema mới dùng migration forward. Không giữ alias app.database/app.config.

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
