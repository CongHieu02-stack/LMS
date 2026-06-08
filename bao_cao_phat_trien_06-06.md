# Báo Cáo Phát Triển Tính Năng & Sửa Lỗi (Ngày 06/06/2026)

Báo cáo chi tiết các tính năng đã nâng cấp và lỗi đã được sửa đổi thành công trong ngày hôm nay:

---

## 1. Loại Bỏ Hoàn Toàn Thông Báo Mặc Định Của Trình Duyệt (Native Localhost Popups)
Để tăng trải nghiệm người dùng cao cấp (UX/UI Premium) và loại bỏ dòng tiêu đề "localhost cho biết" thô kệch, tất cả các hàm `alert()` và `confirm()` trên hệ thống đã được thay thế triệt để:
- **Duyệt môn học ([SubjectApprovalView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/SubjectApprovalView.vue))**:
  - Chuyển `confirm` duyệt môn học thành **Custom Confirm Dialog** (Modal phủ mờ xác nhận thiết kế riêng).
  - Chuyển `alert` khi từ chối môn học thành banner thông báo lỗi màu đỏ đồng bộ ở đầu trang.
- **Phê duyệt môn học khoa ([DepartmentApproveView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/admin/DepartmentApproveView.vue))**:
  - Thay thế `window.confirm` khi phê duyệt môn học bằng **Custom Confirm Dialog** tùy chỉnh.
- **Danh sách môn học ([SubjectListView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/admin/SubjectListView.vue))**:
  - Chuyển đổi `alert` khi khóa học phần thành banner lỗi nội bộ hiển thị trực tiếp bên trong Modal khóa.
- **Quản lý nhân sự ([UserManagementView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/UserManagementView.vue))**:
  - Chuyển `alert` cảnh báo quyền hạn xóa tài khoản thành banner thông báo lỗi ở đầu danh sách.
- **Sinh viên làm bài thi ([ExamTakeView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/ExamTakeView.vue))**:
  - Loại bỏ hoàn toàn `alert` chặn cửa sổ khi hết giờ thi hoặc vi phạm Alt+Tab rời màn hình.
  - Tự động nộp bài và ghi nhận lý do rõ ràng trên trang kết quả thi (ví dụ: *"Bài thi đã bị nộp do bạn vi phạm quy chế (rời màn hình quá 2 lần)."*).
- **Trang chủ ([DashboardView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/DashboardView.vue))**:
  - Tích hợp **PrimeVue Toast** thay thế toàn bộ `alert` khi chọn ảnh đại diện sai định dạng, dung lượng file vượt quá 2MB, lỗi upload hoặc lỗi xuất PDF.

---

## 2. Khắc Phục Lỗi Nhấp Chuột Lan Truyền (Label Click Bug)
- **Vấn đề cũ:** Nhấp vào bất kỳ khoảng trống nào bên cạnh dòng chữ "Thời khóa biểu hàng tuần" hoặc nhãn tiêu đề đều tự động kích hoạt thêm một buổi học mới.
- **Cách xử lý:** Thay đổi thẻ bao ngoài tiêu đề từ `<label>` sang thẻ `<div>` với các class CSS `.fg-label` và `.form-label` tại [ClassProposalView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/ClassProposalView.vue) và [ClassApprovalView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/admin/ClassApprovalView.vue).
- **Kết quả:** Sự kiện click lan truyền bị loại bỏ hoàn toàn, chỉ khi nhấp trực tiếp vào nút `+ Thêm buổi học` mới sinh thêm dòng buổi học.

---

## 3. Ràng Buộc Khoảng Nghỉ Học Vụ Tối Thiểu 5 Phút (Schedule Gap Validation)
- **Vấn đề cũ:** Cho phép đặt lịch học trùng giờ hoặc tiếp giáp sát nhau (ví dụ: buổi một học đến 10:00, buổi hai bắt đầu lúc 10:00) gây khó khăn cho việc di chuyển giữa các phòng học.
- **Cách xử lý:** 
  - Thêm logic kiểm tra khoảng cách thời gian giữa các buổi học trong cùng ngày (phải cách nhau **ít nhất 5 phút**).
  - Tích hợp validation đồng bộ từ giao diện [ClassProposalView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/ClassProposalView.vue), [ClassApprovalView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/admin/ClassApprovalView.vue) cho tới các API trên backend trong [classProposalController.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/controllers/classProposalController.js) và [classController.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/controllers/classController.js).
- **Kết quả:** Hệ thống chặn và hiển thị Toast báo lỗi chi tiết khi không đủ 5 phút di chuyển (ví dụ: *"Lịch học vào Thứ 2 (07:30-10:00 và 10:00-12:00) phải cách nhau ít nhất 5 phút..."*).

---

## 4. Tích Hợp Nhánh `feature/van-tinh` & Khôi Phục Giao Diện Soạn Thảo Bài Giảng
- **Tích hợp nhánh mới**: Đã tiến hành merge nhánh `origin/feature/van-tinh` (chứa các cập nhật của thành viên Vân Tình như bảng lịch sử hoạt động `activity_logs`, cấu hình backend, v.v.) vào nhánh làm việc hiện tại `Duay-ht`.
- **Khôi phục giao diện bài học**: Theo yêu cầu loại bỏ tính năng tải file PDF/Word của Giảng viên, tôi đã khôi phục (revert) file [LessonExamManageView.vue](file:///d:/cot/thuc%20tap/pj3/LMS/src/views/LessonExamManageView.vue) về trạng thái ở commit `3a7ee34`. 
- **Kết quả**: Giao diện tạo/sửa bài giảng của Giảng viên đã quay trở lại trình soạn thảo văn bản HTML/văn bản thường ban đầu.

---

## 5. Sửa Lỗi Sập Server Backend & Giải Phóng Cổng 3000 (EADDRINUSE)
- **Vấn đề**: Sau khi gộp code mới, backend sử dụng thư viện `multer` để upload file nhưng chưa được cài đặt ở local dẫn đến sập server backend. Ngoài ra, tiến trình node cũ bị treo ngầm chiếm dụng cổng 3000 (`EADDRINUSE`).
- **Cách xử lý**:
  - Cập nhật phiên bản thư viện `multer` trong [package.json](file:///d:/cot/thuc%20tap/pj3/LMS/backend/package.json) của backend từ bản thử nghiệm `^2.1.1` (gây lỗi import ở ES Modules) về bản ổn định `^1.4.5-lts.1` và chạy `npm install` ở thư mục `backend/`.
  - Tìm và chấm dứt (taskkill) tiến trình Node ngầm (PID `22112`) đang giữ cổng 3000.
  - Khởi động lại thành công server backend (cổng 3000) và frontend (cổng 5174).
- **Kết quả**: Hệ thống hoạt động trơn tru trở lại, thông tin tài khoản hiển thị đầy đủ trên Dashboard không còn bị trắng.

---

## 6. Khảo Sát Lỗi Tạo Bài Giảng & Bổ Sung Log Giám Sát Backend
- **Vấn đề báo cáo**: Khi Giảng viên nhấn nút "Tạo bài giảng" lần đầu tiên bị báo lỗi, nhấn lần thứ hai mới thành công.
- **Cách xử lý & Điều tra**:
  - Tạo script kiểm tra database [scratch.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/scratch.js) sử dụng Supabase Admin Client để thực hiện thao tác ghi đè/chèn dữ liệu thử nghiệm. Kết quả thao tác ghi diễn ra thành công ngay từ lần đầu tiên (loại trừ lỗi cấu hình/trigger ở DB).
  - Tích hợp thêm lệnh in log chi tiết (`console.log`) thông tin nhận từ Frontend gửi lên và in ra đầy đủ vết lỗi (full error stack trace) trong khối `catch` tại hàm tạo bài giảng ở file [lessonController.js](file:///d:/cot/thuc%20tap/pj3/LMS/backend/src/controllers/lessonController.js).
- **Mục tiêu**: Khi lỗi này lặp lại trên máy local, server backend sẽ in ra chi tiết lỗi cụ thể để có thể khắc phục triệt để ngay lập tức.
