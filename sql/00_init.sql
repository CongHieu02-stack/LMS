-- ============================================================================
-- HỆ THỐNG LMS — SCRIPT KHỞI TẠO DATABASE (Supabase PostgreSQL)
-- Tuân thủ SRP: Mỗi hàm / trigger chỉ thực hiện DUY NHẤT một nhiệm vụ.
-- ============================================================================

-- ============================================================================
-- PHẦN 1: ĐỊNH NGHĨA ENUM TYPES
-- Mục đích: Ràng buộc giá trị hợp lệ cho role và trạng thái phê duyệt.
-- ============================================================================

-- Enum quy định các vai trò trong hệ thống LMS
CREATE TYPE public.user_role AS ENUM (
  'ADMIN',          -- Quản trị tối cao (Rank 100)
  'HIEU_TRUONG',    -- Hiệu trưởng (Rank 90)
  'HR',             -- Nhân sự (Rank 80)
  'PHONG_DAO_TAO',  -- Phòng đào tạo (Rank 70)
  'TRUONG_BO_MON',  -- Trưởng bộ môn (Rank 60)
  'GIANG_VIEN',     -- Giảng viên (Rank 50)
  'SINH_VIEN'       -- Sinh viên (Rank 10)
);

-- Enum trạng thái phê duyệt (dùng cho môn học, lớp học, v.v.)
CREATE TYPE public.approval_status AS ENUM (
  'pending',   -- Chờ phê duyệt
  'approved',  -- Đã phê duyệt
  'rejected'   -- Đã từ chối
);


-- ============================================================================
-- PHẦN 2: BẢNG PROFILES — Hồ sơ người dùng
-- Liên kết 1:1 với auth.users thông qua UUID.
-- ============================================================================

CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL DEFAULT '',
  role       public.user_role NOT NULL DEFAULT 'SINH_VIEN',
  rank       INTEGER NOT NULL DEFAULT 10,
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tăng tốc tìm kiếm theo role
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Index tăng tốc sắp xếp/lọc theo rank
CREATE INDEX idx_profiles_rank ON public.profiles(rank);

COMMENT ON TABLE public.profiles IS 'Bảng hồ sơ người dùng, liên kết 1:1 với auth.users';
COMMENT ON COLUMN public.profiles.rank IS 'Trọng số phân quyền tự động đồng bộ từ role qua trigger';


-- ============================================================================
-- PHẦN 3: TRIGGER #1 — sync_profile_rank()
-- Trách nhiệm DUY NHẤT: Tự động điền giá trị rank khi role thay đổi.
-- KHÔNG làm bất kỳ việc gì khác (không kiểm tra quyền, không validate).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ánh xạ role → rank (Bảng tra cứu tĩnh)
  NEW.rank := CASE NEW.role
    WHEN 'ADMIN'         THEN 100
    WHEN 'HIEU_TRUONG'   THEN 90
    WHEN 'HR'            THEN 80
    WHEN 'PHONG_DAO_TAO' THEN 70
    WHEN 'TRUONG_BO_MON' THEN 60
    WHEN 'GIANG_VIEN'    THEN 50
    WHEN 'SINH_VIEN'     THEN 10
    ELSE 0  -- Giá trị mặc định an toàn
  END;

  -- Cập nhật thời gian sửa đổi
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Trigger kích hoạt TRƯỚC khi INSERT hoặc UPDATE
CREATE TRIGGER trg_sync_profile_rank
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_rank();

COMMENT ON FUNCTION public.sync_profile_rank() IS
  '[SRP] Chỉ đồng bộ rank từ role. Không làm việc khác.';


-- ============================================================================
-- PHẦN 4: TRIGGER #2 — enforce_hierarchy_protection()
-- Trách nhiệm DUY NHẤT: Bảo vệ phân tầng quyền lực.
-- Ngăn chặn người có rank thấp hơn/bằng sửa đổi hoặc xóa người có rank cao.
-- KHÔNG làm bất kỳ việc gì khác (không sync rank, không ghi log).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_hierarchy_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor_id   UUID;
  actor_rank INTEGER;
  target_rank INTEGER;
BEGIN
  -- Lấy ID người đang thực hiện thao tác
  actor_id := auth.uid();

  -- Bỏ qua kiểm tra nếu không có context người dùng (seed data, migration)
  IF actor_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Tra cứu rank của người thao tác
  SELECT p.rank INTO actor_rank
  FROM public.profiles p
  WHERE p.id = actor_id;

  -- Nếu không tìm thấy profile → từ chối
  IF actor_rank IS NULL THEN
    RAISE EXCEPTION '[LMS_HIERARCHY] Không tìm thấy hồ sơ người thao tác (uid: %)', actor_id;
  END IF;

  -- Xác định rank của đối tượng bị tác động
  target_rank := OLD.rank;

  -- === QUY TẮC BẢO VỆ TUYỆT ĐỐI ===
  -- 1. ADMIN (rank 100) không ai được phép chỉnh sửa hay xóa
  IF target_rank = 100 THEN
    RAISE EXCEPTION '[LMS_HIERARCHY] Tài khoản ADMIN được bảo vệ tuyệt đối. Không thể chỉnh sửa hoặc xóa.';
  END IF;

  -- 2. Người thao tác phải có rank CAO HƠN (không phải bằng) đối tượng
  IF actor_rank <= target_rank THEN
    RAISE EXCEPTION '[LMS_HIERARCHY] Từ chối: Rank của bạn (%) không đủ quyền tác động đối tượng có rank (%).',
      actor_rank, target_rank;
  END IF;

  -- Cho phép thao tác
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Trigger kích hoạt TRƯỚC khi UPDATE hoặc DELETE
CREATE TRIGGER trg_enforce_hierarchy_protection
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_hierarchy_protection();

COMMENT ON FUNCTION public.enforce_hierarchy_protection() IS
  '[SRP] Chỉ bảo vệ phân tầng quyền lực. Không sync rank, không ghi log.';


-- ============================================================================
-- PHẦN 5: BẢNG NGHIỆP VỤ — subjects, classes, class_registrations
-- ============================================================================

-- ─── Bảng MÔN HỌC ───
CREATE TABLE public.subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,          -- Mã môn: "CS101", "MATH201"
  name        TEXT NOT NULL,                  -- Tên môn học
  description TEXT DEFAULT '',
  credits     INTEGER NOT NULL DEFAULT 3,     -- Số tín chỉ
  status      public.approval_status NOT NULL DEFAULT 'pending',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subjects_status ON public.subjects(status);

COMMENT ON TABLE public.subjects IS 'Bảng môn học với quy trình phê duyệt';

-- ─── Bảng LỚP HỌC ───
CREATE TABLE public.classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                -- Tên lớp: "CS101-01", "CS101-02"
  instructor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_slots       INTEGER NOT NULL DEFAULT 40,  -- Số chỗ tối đa
  remaining_slots INTEGER NOT NULL DEFAULT 40,  -- Số chỗ còn lại
  schedule        TEXT DEFAULT '',               -- Lịch học: "T2 7:00-9:30, T4 13:00-15:30"
  room            TEXT DEFAULT '',               -- Phòng học
  semester        TEXT DEFAULT '',               -- Học kỳ: "2025-2026/HK1"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ràng buộc: remaining_slots không được âm và không vượt quá max_slots
  CONSTRAINT chk_slots_range CHECK (remaining_slots >= 0 AND remaining_slots <= max_slots)
);

CREATE INDEX idx_classes_subject ON public.classes(subject_id);
CREATE INDEX idx_classes_active ON public.classes(is_active);

COMMENT ON TABLE public.classes IS 'Bảng lớp học với quản lý slot đăng ký';

-- ─── Bảng ĐĂNG KÝ LỚP ───
CREATE TABLE public.class_registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ràng buộc: Một sinh viên chỉ đăng ký một lớp duy nhất một lần
  CONSTRAINT uq_class_student UNIQUE (class_id, student_id)
);

CREATE INDEX idx_registrations_class ON public.class_registrations(class_id);
CREATE INDEX idx_registrations_student ON public.class_registrations(student_id);

COMMENT ON TABLE public.class_registrations IS 'Bảng đăng ký lớp, UNIQUE trên (class_id, student_id)';


-- ─── Bảng NỘP BÀI THI ───
CREATE TABLE public.exam_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_title   TEXT NOT NULL DEFAULT 'Untitled Exam',
  answers      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Mảng câu trả lời
  score        NUMERIC(5,2) DEFAULT NULL,            -- Điểm (NULL = chưa chấm)
  is_forced    BOOLEAN NOT NULL DEFAULT false,        -- true = nộp bắt buộc do gian lận
  violations   INTEGER NOT NULL DEFAULT 0,            -- Số lần vi phạm ghi nhận
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_student ON public.exam_submissions(student_id);

COMMENT ON TABLE public.exam_submissions IS 'Bảng lưu bài nộp thi, có flag gian lận';


-- ============================================================================
-- PHẦN 6: HÀM RPC — register_student_to_class()
-- Trách nhiệm DUY NHẤT: Xử lý đăng ký lớp an toàn với cơ chế khóa dòng.
-- Sử dụng FOR UPDATE để chống Race Condition khi nhiều SV đăng ký cùng lúc.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_student_to_class(
  target_class_id   UUID,
  target_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_slots INTEGER;
  class_name    TEXT;
BEGIN
  -- Bước 1: Khóa dòng lớp học bằng FOR UPDATE (chặn các transaction khác)
  SELECT c.remaining_slots, c.name
  INTO current_slots, class_name
  FROM public.classes c
  WHERE c.id = target_class_id
  FOR UPDATE;  -- ← Khóa dòng tại đây

  -- Bước 2: Kiểm tra lớp tồn tại
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Lớp học không tồn tại.'
    );
  END IF;

  -- Bước 3: Kiểm tra còn chỗ trống
  IF current_slots <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Lớp "' || class_name || '" đã hết chỗ.'
    );
  END IF;

  -- Bước 4: Kiểm tra sinh viên đã đăng ký chưa
  IF EXISTS (
    SELECT 1 FROM public.class_registrations cr
    WHERE cr.class_id = target_class_id AND cr.student_id = target_student_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Bạn đã đăng ký lớp "' || class_name || '" rồi.'
    );
  END IF;

  -- Bước 5: Khấu trừ slot
  UPDATE public.classes
  SET remaining_slots = remaining_slots - 1,
      updated_at = now()
  WHERE id = target_class_id;

  -- Bước 6: Ghi nhận đăng ký
  INSERT INTO public.class_registrations (class_id, student_id)
  VALUES (target_class_id, target_student_id);

  -- Bước 7: Trả kết quả thành công
  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Đăng ký lớp "' || class_name || '" thành công!',
    'remaining',  current_slots - 1
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Bạn đã đăng ký lớp này rồi (trùng lặp).'
    );
END;
$$;

COMMENT ON FUNCTION public.register_student_to_class(UUID, UUID) IS
  '[SRP] Chỉ xử lý đăng ký lớp với khóa dòng FOR UPDATE chống race condition.';


-- ============================================================================
-- PHẦN 7: SEED DATA — Tài khoản Super Admin
-- ============================================================================

-- Bật extension pgcrypto nếu chưa có (Supabase thường đã bật sẵn)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Tạo tài khoản Super Admin trong auth.users bằng một DO block để tránh lỗi ON CONFLICT (email)
DO $$
DECLARE
  super_admin_id UUID;
BEGIN
  -- Lấy ID nếu tài khoản đã tồn tại
  SELECT id INTO super_admin_id FROM auth.users WHERE email = 'ngconghieu2005@gmail.com';

  -- Nếu chưa có thì tạo mới
  IF super_admin_id IS NULL THEN
    super_admin_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    )
    VALUES (
      super_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'ngconghieu2005@gmail.com',
      extensions.crypt('Conghieull1@', extensions.gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Super Admin"}'::jsonb,
      now(),
      now(),
      '',
      ''
    );
  END IF;

  -- Đồng bộ profile Super Admin (trigger sẽ tự động set rank = 100)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    super_admin_id,
    'ngconghieu2005@gmail.com',
    'Super Admin',
    'ADMIN'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'ADMIN'::public.user_role,
      full_name = 'Super Admin';
END $$;


-- ============================================================================
-- PHẦN 8: RLS (Row Level Security) — Chính sách bảo mật cơ bản
-- ============================================================================

-- Bật RLS cho tất cả bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users có thể đọc tất cả profiles
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: Chỉ chính chủ hoặc Admin mới có thể UPDATE (trigger #2 bảo vệ thêm)
CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rank >= 80
    )
  );

-- Subjects: Ai cũng đọc được
CREATE POLICY "subjects_select_all"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

-- Classes: Ai cũng đọc được (để hiển thị danh sách lớp)
CREATE POLICY "classes_select_all"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

-- Class registrations: Sinh viên đọc đăng ký của mình, admin đọc tất cả
CREATE POLICY "registrations_select_own_or_admin"
  ON public.class_registrations FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rank >= 50
    )
  );

-- Exam submissions: Sinh viên đọc bài của mình, giảng viên+ đọc tất cả
CREATE POLICY "exam_select_own_or_instructor"
  ON public.exam_submissions FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rank >= 50
    )
  );

-- Exam submissions: Sinh viên có thể INSERT bài nộp của mình
CREATE POLICY "exam_insert_own"
  ON public.exam_submissions FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());


-- ============================================================================
-- PHẦN 9: ENABLE REALTIME — Cho phép lắng nghe thay đổi bảng classes
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;

COMMENT ON PUBLICATION supabase_realtime IS 'Bật realtime cho bảng classes để FE nhận live updates';


-- ============================================================================
-- HOÀN TẤT — Script đã sẵn sàng chạy trong Supabase SQL Editor
-- ============================================================================
