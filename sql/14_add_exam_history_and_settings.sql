-- ============================================================================
-- MIGRATION #14: Bổ sung các cột phục vụ Lịch sử thi và Cấu hình đáp án chi tiết
-- Chạy trong Supabase SQL Editor hoặc qua pg-meta API
-- ============================================================================

-- 1. Bảng public.exams: Thêm tùy chọn hiển thị đáp án cho sinh viên sau khi nộp
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS show_answers_to_students BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.exams.show_answers_to_students IS 'true: cho phép SV xem đáp án đúng/sai và lời giải chi tiết sau khi nộp. false: chỉ xem điểm số.';

-- 2. Bảng public.exam_submissions: Thêm exam_id và started_at
ALTER TABLE public.exam_submissions 
ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Cập nhật comment giải thích
COMMENT ON COLUMN public.exam_submissions.exam_id IS 'Liên kết trực tiếp tới bảng exams để truy xuất đề thi';
COMMENT ON COLUMN public.exam_submissions.started_at IS 'Thời gian bắt đầu làm bài thi của sinh viên';
