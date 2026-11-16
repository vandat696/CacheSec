# Tài liệu CacheSec

Đọc ba file đầu để nắm dự án. Các tài liệu còn lại dùng khi triển khai hoặc tra cứu.

| Tài liệu | Nội dung sở hữu |
| --- | --- |
| [Mục tiêu và phạm vi](general/overview.md) | Yêu cầu demo, quyết định đã chốt và câu hỏi mở |
| [Trạng thái](general/project-status.md) | Hiện trạng có bằng chứng và việc còn thiếu |
| [Kế hoạch](general/implementation-plan.md) | Sáu gói D1–D6 và điều kiện hoàn thành |
| [Đánh giá](evaluation/design.md) | Fixture/oracle, chỉ số, nguồn đo và protocol |
| [Cài đặt](general/setup.md) | Lệnh chạy, môi trường và xử lý lỗi local |
| [Kiến trúc](system/architecture.md) | Ranh giới module, storage và runtime |
| [API](system/api.md) | Contract, quyền, retry và trạng thái |
| [Cache](system/cache.md) | Lookup, verification, metadata và lifecycle |
| [Phân quyền](system/authorization.md) | Authority, gate, threat boundary và recovery |
| [Sửa/test](system/change-workflow.md) | Revision, artifact, Docker test và evidence |
| [Agent](system/agent-workflow.md) | Vòng sửa/test, công cụ và giới hạn |
| [Source/runtime](system/workspace-runtime.md) | Ghi file thật và human approval/activation |
| [Tổ chức source](system/code-organization.md) | Vị trí implementation và quy ước |
| [Frontend](frontend/design.md) | UI hiện có và phần có thể tái sử dụng |

Mỗi nội dung có một nơi chính; dùng liên kết thay vì chép lại. Phân biệt **đã thống nhất**, **đề xuất**, **đã triển khai** và **đã kiểm chứng**. Không coi màn mẫu, test double hoặc đặc tả mục tiêu là kết quả chạy thật. Mã T trong các tài liệu kỹ thuật là tên gói lịch sử, không phải kế hoạch thực hiện song song với D1–D6.
