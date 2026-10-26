# Nói UI Templates · v2.0.0

Bộ 21 template HTML/CSS/JavaScript thuần. Mỗi template có tên theo chức năng, không phụ thuộc trang catalog hoặc chatbot. `index.html` tại thư mục gốc là catalog để thử và sao chép mã. Dữ liệu trong catalog chỉ là minh họa.

## Lấy tài nguyên vào app

Sao chép cả thư mục `templates/` vào app. Chỉ cần hai stylesheet và một script bên dưới; không cần `app.js`, `kit.js`, `catalog.js` hoặc `styles.css` của trang mẫu.

```html
<link rel="stylesheet" href="templates/tokens.css">
<link rel="stylesheet" href="templates/components.css">
<script defer src="templates/components.js"></script>
<script defer src="your-app.js"></script>
<div id="target"></div>
```

Trong `your-app.js`:

```js
const control = NoiUI.NumberInput({
  label: 'Giới hạn đầu ra', value: 2048,
  min: 256, max: 8192, step: 256, required: true,
  help: '256–8.192 token, bước 256.',
  error: 'Nhập bội số của 256 trong khoảng cho phép.',
  onChange: value => console.log(value)
});
document.querySelector('#target').append(control.element);
// Khi submit: if (control.validate()) save(control.getValue());
// Khi unmount hoặc đổi route:
// control.destroy();
```

`NoiUI.create('NumberInput', options)` tương đương `NoiUI.NumberInput(options)`. Mọi hàm trả về một instance `{ element, destroy, ...methods }`. `element` là DOM thật, có thể gắn vào container bất kỳ. Một instance chỉ mount một nơi; tạo instance mới nếu dùng nhiều nơi.

## API theo tên template

| Template | Đầu vào chính | Phương thức thêm |
|---|---|---|
| Button | label, variant, disabled, onClick(event, instance) | setLoading(boolean) |
| TextInput | label, value, type, placeholder, required, disabled, help, error, validate, onChange | getValue, setValue, validate |
| Textarea | label, value, placeholder, required, disabled, help, validate, onChange | getValue, setValue, validate |
| Select | label, options, value, required, disabled, onChange | getValue, setValue, validate |
| NumberInput | label, value, min, max, step, required, disabled, error, onChange | getValue, setValue, validate |
| Slider | label, value, min, max, step, disabled, help, onChange | getValue, setValue, validate |
| Checkbox | label, checked, disabled, onChange | getValue, setValue |
| Switch | label, checked, disabled, onChange | getValue, setValue |
| Tabs | label, items, selectedIndex, onChange | select(index) |
| Dropdown | label, items, onSelect | open, close |
| Badge | label, tone | — |
| Alert | title, description, tone | — |
| Dialog | title, description, cancelLabel, confirmLabel, onConfirm, onClose | open, close |
| Toast | message, duration (ms) | show(message) |
| StatCard | label, value, description | — |
| ProgressBar | label, value, max, unit | setValue(value, max) |
| DataTable | caption, columns, rows | setData(rows) |
| LineChart | title, unit, data | setData(data) |
| BarChart | title, unit, data | setData(data) |
| DonutChart | title, unit, data | setData(data) |
| FlowDiagram | nodes, selectedId, onSelect | select(id) |

Định nghĩa máy đọc được nằm trong `manifest.json`. Tên API phân biệt hoa thường.

## Dạng dữ liệu và callback

```js
// Select: string[] hoặc { value, label }[]
const select = NoiUI.Select({label: 'Ngôn ngữ', options: [
  {value: 'vi', label: 'Tiếng Việt'}, {value: 'en', label: 'English'}
], value: 'vi', onChange: value => console.log(value)});

// Tabs: nội dung văn bản an toàn, không phải HTML.
const tabs = NoiUI.Tabs({items: [
  {id: 'one', label: 'Tổng quan', content: 'Nội dung thứ nhất'},
  {id: 'two', label: 'Chi tiết', content: 'Nội dung thứ hai'}
], onChange: id => console.log(id)});

// Dropdown: onSelect nhận value của mục.
const menu = NoiUI.Dropdown({items: [
  {label: 'Tạo bản sao', value: 'duplicate'}
], onSelect: value => console.log(value)});

// DataTable: key lấy giá trị tương ứng trong mỗi row.
const table = NoiUI.DataTable({caption: 'Dữ liệu',
  columns: [{key: 'name', label: 'Tên'}, {key: 'value', label: 'Giá trị'}],
  rows: [{name: 'A', value: 10}]
});
```

`onChange` của input/select/checkbox chạy khi DOM phát `change`; Slider cập nhật khi điều chỉnh giá trị hợp lệ. `setValue()` không tự gọi callback. `NumberInput.getValue()` trả `null` khi trống. `validate(value)` tùy chỉnh của input trả thông báo lỗi dạng chuỗi, hoặc giá trị falsy khi hợp lệ. Gọi `validate()` của instance khi submit để kiểm tra cả giới hạn HTML và rule riêng. Không lưu cấu hình nếu còn lỗi.

Button variants: `primary`, `secondary`, `tertiary`, `danger`. Badge tones: `primary`, `success`, `danger`, `neutral`. Alert `tone: 'danger'` dùng role alert; mặc định dùng role status. Nội dung do app cung cấp được gắn bằng `textContent`, không chấp nhận HTML tùy ý.

## Truyền dữ liệu biểu đồ

```js
const chart = NoiUI.DonutChart({
  title: 'Trạng thái', unit: 'Bản ghi',
  data: [
    {label: 'Hoàn tất', value: 75},
    {label: 'Đang xử lý', value: 20},
    {label: 'Cần hỗ trợ', value: 5}
  ]
});
document.querySelector('#target').append(chart.element);
chart.setData([{label: 'Hoàn tất', value: 60}, {label: 'Đang xử lý', value: 40}]);
```

Cùng cấu trúc `{label, value}[]` dùng cho LineChart và BarChart. Thứ tự mảng là thứ tự hiển thị, không tự sắp xếp. Giá trị phải hữu hạn và không âm; giá trị sai bị bỏ qua. Mảng rỗng hiển thị empty state. DonutChart tự tính tổng và góc, bỏ lát 0, xử lý một lát 100%, có vách ngăn thẳng. Biểu đồ có bảng số liệu để đọc nhãn đầy đủ. Không truyền dữ liệu âm cho bộ chart này. Bộ màu lặp sau bốn nhóm; với nhiều nhóm, dùng bảng dữ liệu hoặc gộp nhóm trước khi truyền vào.

## Sơ đồ

```js
const flow = NoiUI.FlowDiagram({nodes: [
  {id: 'input', label: 'Đầu vào', helper: 'Tiếp nhận', description: 'Nhận dữ liệu.'},
  {id: 'output', label: 'Đầu ra', helper: 'Trả kết quả', description: 'Hiển thị kết quả.'}
], onSelect: node => console.log(node.id)});
document.querySelector('#target').append(flow.element);
```

Mỗi `id` phải duy nhất và là chuỗi. Đây là sơ đồ tuyến tính có chọn bước, không phải trình kéo thả hoặc engine thực thi workflow. Sơ đồ chuyển dọc theo chiều rộng container. `Tabs` và `FlowDiagram` gọi callback khi thiết lập lựa chọn ban đầu.

## Dialog, Toast và vòng đời

```js
const dialog = NoiUI.Dialog({title: 'Lưu?', description: 'Xác nhận thay đổi.',
  onConfirm: () => console.log('confirmed')});
document.querySelector('#target').append(dialog.element);
dialog.open(); // Phải mount trước khi mở.

const toast = NoiUI.Toast({duration: 4000});
document.querySelector('#target').append(toast.element);
toast.show('Đã lưu');
```

Dialog dùng `<dialog>` gốc: Esc đóng, focus được trả về control mở. `onConfirm` là callback đồng bộ, dialog đóng ngay sau callback; với thao tác bất đồng bộ hãy quản lý loading và phản hồi ở app. Toast hiển thị ngay trong container được mount, không tự đặt fixed trên toàn trang; app quyết định vị trí thông báo. Dropdown cần container không cắt overflow để menu mở đầy đủ.

Gọi `destroy()` trước khi xóa container hoặc unmount route để hủy event listeners và timer của component. Nếu app thêm event/timer bên ngoài instance, app tự dọn chúng. Với React/Vue/Svelte, mount `element` vào ref khi component được tạo và gọi `destroy()` ở lifecycle cleanup. Gói hiện tại chưa cung cấp wrapper framework, TypeScript declarations, backend hoặc tính năng persistence.

## Thay token và tránh xung đột CSS

```css
.my-app .nui-theme {
  --nui-primary: #1749b6;
  --nui-primary-hover: #10398e;
  --nui-radius: 8px;
  --nui-surface-radius: 0px;
}
```

Các selector được scope bằng `.nui`/`nui-`, không áp dụng reset lên `body`. Gắn override sau hai stylesheet, giữ đủ tương phản khi đổi màu. Namespace giúp giảm xung đột; CSS toàn cục của app có specificity cao hoặc `!important` vẫn có thể ghi đè. Thư viện dùng API browser hiện đại: SVG, AbortController, HTMLDialogElement và container queries. Không cần truy cập mạng hay font ngoài.

## Hiệu ứng chuyển động

Các template có hiệu ứng ngắn cho mở menu/dialog, toast, chuyển tab, phản hồi lỗi, biểu đồ và nhấn nút. Chuyển động chỉ dùng opacity và transform; không thay đổi kích thước bố cục. Dialog có chuyển động đóng trên trình duyệt hỗ trợ discrete transitions; trình duyệt khác đóng ngay. `prefers-reduced-motion: reduce` tắt animation và transition.

Có thể điều chỉnh sau stylesheet:

```css
.my-app .nui-theme {
  --nui-motion: 180ms;
  --nui-enter: 240ms;
  --nui-exit: 150ms;
  --nui-ease-out: cubic-bezier(.2,.8,.2,1);
}
```

Hiệu ứng xuất hiện theo cuộn chỉ thuộc catalog (`styles.css`), không phải phụ thuộc của tài nguyên template.
