# Tham chiếu giao diện Nói

- index.html: catalog JS và chat minh họa, chạy bằng static server.
- templates/src/: source JS theo component; templates/README.md hướng dẫn nhúng.
- templates/components.js: bundle sinh bằng npm run templates:build, không sửa tay.
- catalog/data.js: dữ liệu demo; catalog/page.js: lắp ghép catalog.
- demo-shell.js: shell/chat minh họa, không phải React app.
- legacy/extended-kit-prototype.js: prototype cũ (trước là kit.js), không tải trong index.

React app dùng frontend/src/components/ui; [bản đồ source](../../docs/system/code-organization.md) chỉ rõ ranh giới. DESIGN-MANIFEST ghi nguồn xuất và danh mục file sau refactor, không phải bằng chứng backend đã chạy.
