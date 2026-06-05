-- ============================================================================
-- 09_add_schedule_to_class_proposals.sql — Bổ sung cột lịch học vào đề xuất lớp & RPC check trùng phòng
-- ============================================================================

-- 1. Bổ sung cột schedule cho bảng class_proposals
ALTER TABLE public.class_proposals ADD COLUMN IF NOT EXISTS schedule TEXT DEFAULT '';

-- 2. Tạo hàm RPC check_room_overlap_for_approve để kiểm tra trùng lịch phòng học
CREATE OR REPLACE FUNCTION public.check_room_overlap_for_approve(
  p_room_name TEXT,
  p_schedule TEXT,
  p_class_id UUID
) RETURNS JSON AS $$
DECLARE
  v_overlap BOOLEAN;
  v_result JSON;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE room = p_room_name
      AND status IN ('approved', 'APPROVED', 'open_for_reg', 'in_progress')
      AND public.schedules_overlap(schedule, p_schedule)
      AND id <> p_class_id
  ) INTO v_overlap;

  v_result := json_build_object('has_overlap', v_overlap);
  RETURN v_result;
END;
-- Bổ sung SECURITY DEFINER để bypass RLS nếu gọi từ phía client được phân quyền
$$ LANGUAGE plpgsql SECURITY DEFINER;
