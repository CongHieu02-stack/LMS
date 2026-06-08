// ============================================================================
// views/classView.js — View formatter cho Class & Registration
// Trách nhiệm DUY NHẤT: Format dữ liệu lớp học thành JSON response.
// KHÔNG chứa logic nghiệp vụ hay truy vấn DB.
// ============================================================================

/**
 * Format một lớp học đơn lẻ
 * @param {object} raw — Class row từ database (kèm subject, instructor)
 * @returns {object}
 */
export function formatClass(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    maxSlots: raw.max_slots,
    remainingSlots: raw.remaining_slots,
    schedule: raw.schedule,
    room: raw.room,
    semester: raw.semester,
    isActive: raw.is_active,
    instructorId: raw.instructor_id || null,
    status: raw.status || 'draft',
    maxStudents: raw.max_students || null,
    roomId: raw.room_id || null,
    startDate: raw.start_date || null,
    endDate: raw.end_date || null,
    subject: raw.subject
      ? {
          id: raw.subject.id,
          code: raw.subject.code,
          name: raw.subject.name,
          credits: raw.subject.credits,
          department: raw.subject.department,
        }
      : null,
    instructor: raw.instructor
      ? {
          id: raw.instructor.id,
          fullName: raw.instructor.full_name,
          email: raw.instructor.email,
        }
      : null,
    manager: raw.manager
      ? {
          id: raw.manager.id,
          fullName: raw.manager.full_name,
          email: raw.manager.email,
        }
      : null,
    createdAt: raw.created_at,
  }
}

/**
 * Format danh sách lớp học
 * @param {Array} rawList
 * @returns {object} — { data: [...], total }
 */
export function formatClassList(rawList) {
  return {
    data: (rawList || []).map(formatClass),
    total: rawList?.length || 0,
  }
}

/**
 * Format kết quả đăng ký lớp (từ RPC)
 * @param {object} rpcResult — { success, message/error, remaining? }
 * @returns {object}
 */
export function formatRegistrationResult(rpcResult) {
  if (!rpcResult) {
    return { success: false, message: 'Không nhận được phản hồi từ server.' }
  }
  return {
    success: rpcResult.success,
    message: rpcResult.success ? rpcResult.message : rpcResult.error,
    remainingSlots: rpcResult.remaining ?? null,
  }
}

/**
 * Format danh sách lớp đã đăng ký của sinh viên
 * @param {Array} rawList
 * @returns {object}
 */
export function formatStudentRegistrations(rawList) {
  return {
    data: (rawList || []).map((item) => ({
      id: item.id,
      registeredAt: item.registered_at,
      class: item.class
        ? {
            id: item.class.id,
            name: item.class.name,
            remainingSlots: item.class.remaining_slots,
            maxSlots: item.class.max_slots,
            subjectCode: item.class.subject?.code,
            subjectName: item.class.subject?.name,
            instructor: item.class.instructor,
          }
        : null,
    })),
    total: rawList?.length || 0,
  }
}
