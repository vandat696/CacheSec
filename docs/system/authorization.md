# Phân quyền và bảo mật

## Quyền và freshness


Identity/tenant từ backend; kiểm tra mọi nguồn câu trả lời. Role/quyền cũ trong token/entry không chứng minh quyền hiện tại. Không xác minh được thì không trả cache. Offline policy chưa chốt.

## Threat model cần chốt

- Cross-tenant, metadata giả, nguồn/policy cũ, role/thuộc tính thay đổi.
- Câu gần nghĩa khác đáp án/quyền, dịch vụ quyền lỗi.
- Cache poisoning: sửa câu trả lời/vector/metadata local.
- XSS, người kiểm soát thiết bị, nội dung đã sao chép.

Quyền trên source ID không chứng minh nội dung local chưa bị sửa; cơ chế toàn vẹn cần thiết kế. Mã hóa/quản lý khóa là vấn đề riêng; không tuyên bố frontend bảo vệ plaintext khỏi người kiểm soát thiết bị.

## Cần chốt

RBAC/ABAC cụ thể, cơ chế toàn vẹn, freshness khi thu hồi, offline và giới hạn bảo vệ local. Các tham số matching thuộc [thiết kế cache](cache.md). Unsafe chỉ là đối chứng tùy chọn bằng dữ liệu giả lập.

## Quy tắc chung

Backend thực thi quyền cho cả retrieval, generation và cache reuse. Xác minh mọi nguồn phụ thuộc từ identity, tenant và metadata đáng tin cậy; không tin client tự khai quyền.

Similarity không phải authorization. Thu hồi quyền phải ngăn reuse theo freshness đã công bố, không thu hồi nội dung đã đọc. Mô hình RBAC/ABAC cụ thể chưa chốt. Xem [metadata cache](cache.md).
