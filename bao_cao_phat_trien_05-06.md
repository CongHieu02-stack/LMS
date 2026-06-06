# Báo Cáo Tổng Hợp Công Việc (05/06 - 06/06)

Báo cáo tóm tắt toàn bộ tính năng và sửa lỗi đã thực hiện thành công từ ngày **05/06** đến thời điểm hiện tại:

---

## 1. Lịch Học Chi Tiết & Quy Trình Duyệt Lớp (Hybrid Flow)
* **Cấu trúc lại Database:** Viết các migration tạo cột lịch học (`schedule`), ngày bắt đầu/kết thúc (`start_date`, `end_date`), và hàm kiểm tra trùng lịch phòng học.
* **Bộ chọn lịch học tương tác:** Tích hợp bộ chọn nhiều buổi học/tuần trực quan cho cả Trưởng bộ môn (TBM) và Phòng đào tạo (PĐT).
* **Ràng buộc học vụ:**
  - Chặn ngày bắt đầu nhỏ hơn 14 ngày (luật đề xuất trước 2 tuần).
  - So khớp sĩ số tối đa với sức chứa tối đa của phòng học.
  - Bắt buộc điền học kỳ dạng `HK[1-3]-[Năm]` (Regex) và chặn năm học quá khứ.
* **Nâng cấp UX:** Chuyển đổi toàn bộ thông báo thành PrimeVue Toast (popup góc phải) và thiết kế Custom Confirm Modal loại bỏ tiêu đề "localhost says".

---

## 2. Nâng Cấp Quản Lý Bài Giảng (Role Giảng Viên)
* Hoàn thiện và nâng cấp giao diện, luồng lập trình cho tính năng **Tạo & Sửa bài giảng (Lessons)** của giảng viên.
* Sửa lỗi liên kết, hiển thị form và lỗi đính kèm học liệu.

---

## 3. Hoàn Thiện Bảng Điểm & Sửa Lỗi Bài Kiểm Tra
* **Hỗ trợ song song 2 thang điểm:** Giải quyết xung đột trong `GradeView` để hỗ trợ hiển thị cả thang điểm 4.0 và thang điểm 10.0.
* Khắc phục triệt để các lỗi logic tính điểm, lưu trữ điểm thi và hiển thị bảng điểm của sinh viên.

---

## 4. Quản Lý Khung Lớp & Phân Quyền Theo Vai Trò (Actor Permissions)
* Tạo danh sách khung lớp học và danh sách môn học.
* Thiết lập danh sách chức năng phân quyền chi tiết cho từng tác nhân trong hệ thống (Sinh viên, Giảng viên, Trưởng bộ môn, Phòng đào tạo).

---

## 5. Đồng Bộ Hệ Thống (Git Pull & Merge)
* Đồng bộ code mới từ GitHub, xử lý xung đột code trong `classController.js` và `tsconfig.tsbuildinfo`.
* Tích hợp thành công tính năng **Nhật ký hoạt động hệ thống (Activity Logs)** từ xa vào backend và giao diện admin.
