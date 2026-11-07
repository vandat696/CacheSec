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
    settings.py                                cấu hình QUOTATION_ riêng
    domain/quotation.py                        QuotationCreate/Record/Page
    persistence/
      postgres_quotation_repository.py          PostgresQuotationRepository
      migrations.py                            history/checksum/transaction/lock
      sql/001_create_quotations.sql              SQL đã version hóa
    migrate.py                                 CLI composition root
```

Domain không nhập persistence/HTTP/control. Repository nhận connection qua constructor, caller quản lý transaction; shared adapter không nhập domain/control. tests/control, tests/shared và tests/quotation_demo đi theo module sở hữu. Không tạo service/base class/controller rỗng khi chưa có logic tương ứng.

OOP dùng cho adapter có trạng thái/phụ thuộc (PostgresDatabase, PostgresQuotationRepository); logic thuần giữ function. Đóng gói và hướng phụ thuộc quan trọng hơn số class hoặc tầng kế thừa. Giữ lệnh uvicorn app.main:app, python -m app.quotation_demo.migrate; không đổi API /health, /ready, env, schema hoặc version/checksum migration. Import Python nội bộ chuyển sang đường dẫn mới; không giữ alias app.database/app.config.

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
