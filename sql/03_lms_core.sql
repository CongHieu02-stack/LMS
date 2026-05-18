-- ============================================================================
-- HỆ THỐNG LMS — SCRIPT KHỞI TẠO BẢNG CỐT LÕI (Supabase PostgreSQL)
-- Bao gồm: Môn học, Lớp học, Đăng ký, Bài giảng, Bài thi, Bảng điểm
-- ============================================================================

-- Bật UUID extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DỌN DẸP BẢNG CŨ (Nếu có) ĐỂ TRÁNH LỖI "ALREADY EXISTS"
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.class_enrollments CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;

-- ============================================================================
-- 1. BẢNG MÔN HỌC (subjects)
-- ============================================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- Mã môn học, vd: INT101
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  description TEXT,
  status public.approval_status NOT NULL DEFAULT 'pending',
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.subjects IS 'Danh mục môn học và trạng thái đề xuất';

-- ============================================================================
-- 2. BẢNG LỚP HỌC (classes)
-- ============================================================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL, -- Mã lớp, vd: INT101-01
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  semester TEXT NOT NULL, -- Học kỳ, vd: HK1-2026
  max_students INTEGER NOT NULL DEFAULT 50 CHECK (max_students > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open_for_reg', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.classes IS 'Danh sách các lớp học được mở thực tế';

-- ============================================================================
-- 3. BẢNG ĐĂNG KÝ LỚP (class_enrollments)
-- ============================================================================
CREATE TABLE public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'dropped', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id) -- 1 sinh viên chỉ đăng ký 1 lớp 1 lần
);
COMMENT ON TABLE public.class_enrollments IS 'Sinh viên đăng ký lớp học';

-- ============================================================================
-- 4. BẢNG BÀI GIẢNG (lessons)
-- ============================================================================
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- Nội dung bài học (HTML hoặc Markdown)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.lessons IS 'Nội dung các bài học trong một lớp';

-- ============================================================================
-- 5. BẢNG BÀI KIỂM TRA (exams)
-- ============================================================================
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_score NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.exams IS 'Các bài thi/kiểm tra thuộc một lớp học';

-- ============================================================================
-- 6. BẢNG ĐIỂM (grades)
-- ============================================================================
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, student_id) -- 1 sinh viên chỉ có 1 đầu điểm cho 1 bài thi
);
COMMENT ON TABLE public.grades IS 'Điểm số của sinh viên';

-- ============================================================================
-- BẢO MẬT: BẬT ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHÍNH SÁCH RLS CƠ BẢN
-- Lưu ý: Supabase RLS policies. Hiện tại để đơn giản hóa quá trình phát triển API backend 
-- (nơi chúng ta đang dùng Service Role Key hoặc kiểm tra quyền qua Backend),
-- ta có thể tạm thời cấp quyền truy cập toàn diện cho authenticated users.
-- Các logic bảo vệ sẽ được xử lý ở Tầng Backend (Express MVC).
-- ============================================================================

CREATE POLICY "Allow authenticated full access to subjects" 
ON public.subjects FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to classes" 
ON public.classes FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to class_enrollments" 
ON public.class_enrollments FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to lessons" 
ON public.lessons FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to exams" 
ON public.exams FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to grades" 
ON public.grades FOR ALL TO authenticated USING (true);
