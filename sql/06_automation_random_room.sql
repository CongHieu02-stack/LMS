-- ============================================================================
-- 06_automation_random_room.sql — Migration cho Tự động hóa xếp phòng ngẫu nhiên
-- ============================================================================

-- 1. Tạo bảng public.rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Thêm dữ liệu phòng mẫu (Mock rooms - 55 phòng đa dạng quy mô)
INSERT INTO public.rooms (name, capacity) VALUES
-- Tòa A: Phòng lý thuyết nhỏ & vừa (sức chứa 30 - 50)
('A101', 30), ('A102', 30), ('A103', 35), ('A104', 35), ('A105', 40),
('A201', 40), ('A202', 40), ('A203', 45), ('A204', 45), ('A205', 50),
-- Tòa B: Phòng học tầm trung (sức chứa 50 - 70)
('B101', 50), ('B102', 50), ('B103', 55), ('B104', 55), ('B105', 60),
('B201', 60), ('B202', 60), ('B203', 65), ('B204', 65), ('B205', 70),
-- Tòa C: Giảng đường vừa & lớn (sức chứa 70 - 100)
('C101', 70), ('C102', 70), ('C103', 75), ('C104', 75), ('C105', 80),
('C201', 80), ('C202', 80), ('C203', 85), ('C204', 85), ('C205', 90),
('C301', 90), ('C302', 90), ('C303', 95), ('C304', 95), ('C305', 100),
-- Tòa D: Giảng đường hội trường lớn (sức chứa 120 - 200)
('D101', 120), ('D102', 120), ('D103', 130), ('D104', 130), ('D105', 150),
('D201', 150), ('D202', 150), ('D203', 180), ('D204', 180), ('D205', 200),
-- Tòa E: Phòng Lab thực hành máy tính (sức chứa 30 - 50)
('E101', 30), ('E102', 30), ('E103', 35), ('E104', 35), ('E105', 40),
('E201', 40), ('E202', 40), ('E203', 45), ('E204', 45), ('E205', 50)
ON CONFLICT (name) DO NOTHING;

-- 3. Cập nhật bảng public.classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS max_students INTEGER;

-- Cập nhật ràng buộc status để chấp nhận 'APPROVED' và 'approved'
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_status_check;
ALTER TABLE public.classes ADD CONSTRAINT classes_status_check CHECK (status IN ('draft', 'approved', 'APPROVED', 'open_for_reg', 'in_progress', 'completed', 'rejected'));

-- 4. Tạo hàm helper kiểm tra trùng lịch học
CREATE OR REPLACE FUNCTION public.schedules_overlap(s1 TEXT, s2 TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  slot1 TEXT;
  slot2 TEXT;
  day1 TEXT;
  day2 TEXT;
  p1_start INT;
  p1_end INT;
  p2_start INT;
  p2_end INT;
  
  -- Hỗ trợ định dạng thời gian (phút tính từ đầu ngày)
  t1_start INT;
  t1_end INT;
  t2_start INT;
  t2_end INT;
  time_match1 TEXT[];
  time_match2 TEXT[];
BEGIN
  -- Nếu một trong hai lịch trống thì coi như không trùng (bỏ qua kiểm tra)
  IF s1 IS NULL OR s1 = '' OR s2 IS NULL OR s2 = '' THEN
    RETURN FALSE;
  END IF;

  -- Chuyển về chữ hoa và loại bỏ khoảng trắng thừa để chuẩn hóa
  s1 := upper(trim(s1));
  s2 := upper(trim(s2));

  -- Duyệt qua từng slot của lịch 1 (phân tách bởi dấu phẩy hoặc dấu chấm phẩy)
  FOR slot1 IN SELECT regexp_split_to_table(s1, '[,;]') LOOP
    slot1 := trim(slot1);
    IF slot1 = '' THEN CONTINUE; END IF;

    -- Tìm Thứ (T2, T3, T4, T5, T6, T7, CN)
    day1 := substring(slot1 from '^(T[2-7]|CN)');
    IF day1 IS NULL THEN
      -- Nếu không tìm thấy Thứ chuẩn, so sánh toàn bộ chuỗi
      IF s1 = s2 THEN RETURN TRUE; END IF;
      CONTINUE;
    END IF;

    p1_start := NULL; p1_end := NULL;
    t1_start := NULL; t1_end := NULL;

    -- Thử định dạng Tiết học: (T1-3) hoặc (1-3)
    IF slot1 ~ '\((?:T)?([0-9]+)-([0-9]+)\)' THEN
      p1_start := (regexp_matches(slot1, '\((?:T)?([0-9]+)-([0-9]+)\)'))[1]::INT;
      p1_end := (regexp_matches(slot1, '\((?:T)?([0-9]+)-([0-9]+)\)'))[2]::INT;
    -- Thử định dạng Giờ phút: 7:00-9:30 hoặc 07:00-09:30
    ELSIF slot1 ~ '([0-9]{1,2}):([0-9]{2})\s*-\s*([0-9]{1,2}):([0-9]{2})' THEN
      time_match1 := regexp_matches(slot1, '([0-9]{1,2}):([0-9]{2})\s*-\s*([0-9]{1,2}):([0-9]{2})');
      t1_start := time_match1[1]::INT * 60 + time_match1[2]::INT;
      t1_end := time_match1[3]::INT * 60 + time_match1[4]::INT;
    ELSE
      -- Nếu không nhận diện được định dạng chi tiết, coi như chiếm dụng toàn bộ ngày (tiết 1 - 10)
      p1_start := 1;
      p1_end := 10;
    END IF;

    -- Duyệt qua từng slot của lịch 2
    FOR slot2 IN SELECT regexp_split_to_table(s2, '[,;]') LOOP
      slot2 := trim(slot2);
      IF slot2 = '' THEN CONTINUE; END IF;

      day2 := substring(slot2 from '^(T[2-7]|CN)');
      IF day2 IS NULL OR day1 <> day2 THEN
        CONTINUE; -- Khác thứ thì không thể trùng lịch học
      END IF;

      p2_start := NULL; p2_end := NULL;
      t2_start := NULL; t2_end := NULL;

      IF slot2 ~ '\((?:T)?([0-9]+)-([0-9]+)\)' THEN
        p2_start := (regexp_matches(slot2, '\((?:T)?([0-9]+)-([0-9]+)\)'))[1]::INT;
        p2_end := (regexp_matches(slot2, '\((?:T)?([0-9]+)-([0-9]+)\)'))[2]::INT;
      ELSIF slot2 ~ '([0-9]{1,2}):([0-9]{2})\s*-\s*([0-9]{1,2}):([0-9]{2})' THEN
        time_match2 := regexp_matches(slot2, '([0-9]{1,2}):([0-9]{2})\s*-\s*([0-9]{1,2}):([0-9]{2})');
        t2_start := time_match2[1]::INT * 60 + time_match2[2]::INT;
        t2_end := time_match2[3]::INT * 60 + time_match2[4]::INT;
      ELSE
        p2_start := 1;
        p2_end := 10;
      END IF;

      -- So sánh Tiết học
      IF p1_start IS NOT NULL AND p2_start IS NOT NULL THEN
        IF (p1_start <= p2_end) AND (p2_start <= p1_end) THEN
          RETURN TRUE;
        END IF;
      -- So sánh Giờ phút
      ELSIF t1_start IS NOT NULL AND t2_start IS NOT NULL THEN
        IF (t1_start <= t2_end) AND (t2_start <= t1_end) THEN
          RETURN TRUE;
        END IF;
      -- Dự phòng: Nếu cùng ngày nhưng định dạng cồng kềnh, coi như bận để đảm bảo an toàn học vụ
      ELSE
        RETURN TRUE;
      END IF;
    END LOOP;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 5. Tạo RPC function approve_class_and_random_room
CREATE OR REPLACE FUNCTION public.approve_class_and_random_room(
  p_class_id UUID,
  p_max_students INT
) RETURNS JSON AS $$
DECLARE
  v_room_id UUID;
  v_room_name TEXT;
  v_user_rank INT;
  v_class_schedule TEXT;
  v_result JSON;
BEGIN
  -- Lấy lịch học của lớp đang được xét duyệt
  SELECT schedule INTO v_class_schedule FROM public.classes WHERE id = p_class_id;

  -- Kiểm tra rank của người dùng thực hiện (nếu thông qua JWT auth)
  SELECT rank INTO v_user_rank FROM public.profiles WHERE id = auth.uid();
  
  IF auth.uid() IS NOT NULL AND (v_user_rank IS NULL OR v_user_rank < 70) THEN
    RAISE EXCEPTION 'Bạn không có quyền thực hiện hành động này. Rank yêu cầu >= 70.';
  END IF;

  -- Tìm phòng trống có capacity >= p_max_students
  -- Phòng học chỉ bị loại trừ nếu nó ĐANG ĐƯỢC DÙNG bởi lớp khác TRÙNG LỊCH HỌC
  SELECT id, name INTO v_room_id, v_room_name
  FROM public.rooms
  WHERE capacity >= p_max_students
    AND id NOT IN (
      SELECT room_id
      FROM public.classes
      WHERE room_id IS NOT NULL
        AND status IN ('approved', 'APPROVED', 'open_for_reg', 'in_progress')
        AND public.schedules_overlap(schedule, v_class_schedule)
    )
  ORDER BY RANDOM()
  LIMIT 1;

  -- Nếu không tìm thấy phòng học trống phù hợp
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy phòng học nào trống có sức chứa >= % vào lịch học: %', p_max_students, COALESCE(v_class_schedule, 'Chưa xếp lịch');
  END IF;

  -- Cập nhật lớp học
  UPDATE public.classes
  SET status = 'APPROVED',
      room_id = v_room_id,
      room = v_room_name, -- Đồng bộ sang cột text cũ để tương thích ngược
      max_students = p_max_students,
      max_slots = p_max_students,
      remaining_slots = p_max_students,
      updated_at = now()
  WHERE id = p_class_id;

  -- Nếu lớp học không tồn tại
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy lớp học với ID: %', p_class_id;
  END IF;

  -- Trả về thông tin phòng đã gán
  v_result := json_build_object(
    'success', true,
    'room_id', v_room_id,
    'room_name', v_room_name,
    'max_students', p_max_students
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
