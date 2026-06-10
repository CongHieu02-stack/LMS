-- ============================================================================
-- HỆ THỐNG LMS — SCRIPT DI CƯ (MIGRATION)
-- 1. Thêm cột subject_id cho bảng class_registrations
-- 2. Thêm ràng buộc UNIQUE (student_id, subject_id)
-- 3. Cập nhật hàm RPC register_student_to_class() để chặn đăng ký trùng môn học
-- ============================================================================

-- 1. Thêm cột subject_id cho bảng class_registrations (nếu chưa tồn tại)
ALTER TABLE public.class_registrations 
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE;

-- 2. Điền dữ liệu subject_id cho những bản ghi đăng ký lớp hiện có
UPDATE public.class_registrations cr
SET subject_id = c.subject_id
FROM public.classes c
WHERE cr.class_id = c.id AND cr.subject_id IS NULL;

-- 3. Đặt điều kiện NOT NULL cho cột subject_id sau khi đã đồng bộ dữ liệu
ALTER TABLE public.class_registrations 
  ALTER COLUMN subject_id SET NOT NULL;

-- Xóa các bản ghi đăng ký trùng lặp môn học của cùng một sinh viên (chỉ giữ lại bản ghi đăng ký sớm nhất)
DELETE FROM public.class_registrations cr
WHERE cr.id NOT IN (
  SELECT DISTINCT ON (student_id, subject_id) id
  FROM public.class_registrations
  ORDER BY student_id, subject_id, registered_at ASC
);

-- 4. Thêm ràng buộc UNIQUE (student_id, subject_id) để chặn việc đăng ký nhiều lớp cùng môn học
ALTER TABLE public.class_registrations 
  DROP CONSTRAINT IF EXISTS uq_student_subject,
  ADD CONSTRAINT uq_student_subject UNIQUE (student_id, subject_id);

-- 5. Cập nhật hàm RPC register_student_to_class() để kiểm tra và thông báo lỗi
CREATE OR REPLACE FUNCTION public.register_student_to_class(
  target_class_id   UUID,
  target_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_slots       INTEGER;
  class_name          TEXT;
  target_subject_id   UUID;
  existing_class_name TEXT;
BEGIN
  -- Chọn slots, name, và subject_id của lớp học
  SELECT c.remaining_slots, c.name, c.subject_id
  INTO current_slots, class_name, target_subject_id
  FROM public.classes c
  WHERE c.id = target_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lớp học không tồn tại.');
  END IF;

  IF current_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lớp "' || class_name || '" đã hết chỗ.');
  END IF;

  -- Kiểm tra sinh viên đã đăng ký bất cứ lớp nào của môn học này chưa
  SELECT c.name INTO existing_class_name
  FROM public.class_registrations cr
  JOIN public.classes c ON c.id = cr.class_id
  WHERE c.subject_id = target_subject_id AND cr.student_id = target_student_id
  LIMIT 1;

  IF existing_class_name IS NOT NULL THEN
    IF existing_class_name = class_name THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'Bạn đã đăng ký lớp "' || class_name || '" rồi.'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error',   'Bạn đã đăng ký lớp "' || existing_class_name || '" của môn học này rồi. Mỗi môn học chỉ được đăng ký tối đa 1 lớp.'
      );
    END IF;
  END IF;

  -- Giảm số lượng slots còn lại
  UPDATE public.classes 
  SET remaining_slots = remaining_slots - 1,
      updated_at = now()
  WHERE id = target_class_id;

  -- Đăng ký sinh viên vào lớp học
  INSERT INTO public.class_registrations (class_id, student_id, subject_id)
  VALUES (target_class_id, target_student_id, target_subject_id);

  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Đăng ký lớp "' || class_name || '" thành công!',
    'remaining',  current_slots - 1
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Bạn đã đăng ký một lớp học thuộc môn này rồi.'
    );
END;
$$;
