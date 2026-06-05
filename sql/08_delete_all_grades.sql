-- ============================================================================
-- MIGRATION #08: Xóa tất cả kết quả bài kiểm tra từ bảng grades
-- Chạy trong Supabase SQL Editor
-- ============================================================================
-- CẢNH BÁO: Hành động này sẽ xóa TẤT CẢ điểm bài kiểm tra trong hệ thống
-- Hãy chắc chắn bạn muốn thực hiện điều này trước khi chạy!

-- Xóa tất cả điểm bài kiểm tra (có exam_id)
DELETE FROM public.grades
WHERE exam_id IS NOT NULL;

-- Reset sequence cho id (tùy chọn)
-- ALTER SEQUENCE public.grades_id_seq RESTART WITH 1;
