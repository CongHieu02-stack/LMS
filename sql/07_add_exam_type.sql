-- ============================================================================
-- MIGRATION #07: Thêm exam_type để phân biệt điểm giữa kỳ và cuối kỳ
-- Chạy trong Supabase SQL Editor
-- ============================================================================

-- BƯỚC 1: Xóa constraint cũ nếu có (để có thể cập nhật dữ liệu)
ALTER TABLE public.exams 
DROP CONSTRAINT IF EXISTS exams_exam_type_check;

-- BƯỚC 2: Thêm cột exam_type nếu chưa có (không có constraint)
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS exam_type TEXT;

-- BƯỚC 3: Cập nhật các bản ghi NULL hoặc 'other' thành 'midterm'
UPDATE public.exams 
SET exam_type = 'midterm' 
WHERE exam_type IS NULL OR exam_type = 'other';

-- BƯỚC 4: Đảm bảo cột NOT NULL
ALTER TABLE public.exams 
ALTER COLUMN exam_type SET NOT NULL;

-- BƯỚC 5: Đặt default
ALTER TABLE public.exams 
ALTER COLUMN exam_type SET DEFAULT 'midterm';

-- BƯỚC 6: Thêm constraint mới chỉ cho phép midterm và final
ALTER TABLE public.exams 
ADD CONSTRAINT exams_exam_type_check CHECK (exam_type IN ('midterm', 'final'));

-- Comment cho cột mới
COMMENT ON COLUMN public.exams.exam_type IS 'Loại bài thi: midterm (giữa kỳ 40%), final (cuối kỳ 60%)';
