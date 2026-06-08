// ============================================================================
// controllers/timetableController.js — Controller thời khoá biểu
// Trách nhiệm DUY NHẤT: Lấy danh sách lớp học của user (SV/GV) và trả về
// dữ liệu đã parse schedule để frontend render bảng lưới tuần.
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

/**
 * Parse chuỗi schedule thành mảng sessions.
 * Input:  "T2(07:30-10:00), T5(13:00-15:00)"
 * Output: [{ day: "T2", startTime: "07:30", endTime: "10:00" }, ...]
 */
function parseSchedule(scheduleStr) {
  if (!scheduleStr) return []
  const parts = scheduleStr.split(',').map(p => p.trim())
  const sessions = []

  for (const part of parts) {
    if (!part) continue
    const match = part.match(/^([A-Z0-9]+)\((\d{2}:\d{2})-(\d{2}:\d{2})\)$/i)
    if (match) {
      sessions.push({
        day: match[1].toUpperCase(),
        startTime: match[2],
        endTime: match[3]
      })
    }
  }
  return sessions
}

/**
 * GET /api/timetable/me — Lấy thời khoá biểu của user hiện tại.
 * Tự động phân biệt Sinh viên vs Giảng viên.
 */
export async function getMyTimetable(req, res) {
  try {
    const userId = req.user.id
    const userRole = req.profile?.role

    let classes = []

    if (userRole === 'SINH_VIEN') {
      // ─── SINH VIÊN: Lấy lớp đã đăng ký ───
      const { data, error } = await supabaseAdmin
        .from('class_registrations')
        .select(`
          class_id,
          class:classes(
            id, name, code, schedule, room, semester,
            start_date, end_date, status,
            subject:subjects(id, code, name, credits),
            instructor:profiles!instructor_id(id, full_name, email)
          )
        `)
        .eq('student_id', userId)

      if (error) throw error

      classes = (data || [])
        .filter(r => r.class && r.class.status === 'APPROVED')
        .map(r => {
          const c = r.class
          return {
            classId: c.id,
            className: c.name || c.code,
            subjectCode: c.subject?.code || '',
            subjectName: c.subject?.name || '',
            credits: c.subject?.credits || 0,
            schedule: c.schedule || '',
            sessions: parseSchedule(c.schedule),
            room: c.room || '',
            semester: c.semester || '',
            startDate: c.start_date || null,
            endDate: c.end_date || null,
            instructor: c.instructor
              ? { id: c.instructor.id, fullName: c.instructor.full_name, email: c.instructor.email }
              : null
          }
        })
    } else if (['GIANG_VIEN', 'TRUONG_BO_MON'].includes(userRole)) {
      // ─── GIẢNG VIÊN / TRƯỞNG BỘ MÔN: Lấy lớp đang dạy ───
      const { data, error } = await supabaseAdmin
        .from('classes')
        .select(`
          id, name, code, schedule, room, semester,
          start_date, end_date, status,
          subject:subjects(id, code, name, credits),
          registrations:class_registrations(count)
        `)
        .eq('instructor_id', userId)
        .eq('status', 'APPROVED')

      if (error) throw error

      classes = (data || []).map(c => ({
        classId: c.id,
        className: c.name || c.code,
        subjectCode: c.subject?.code || '',
        subjectName: c.subject?.name || '',
        credits: c.subject?.credits || 0,
        schedule: c.schedule || '',
        sessions: parseSchedule(c.schedule),
        room: c.room || '',
        semester: c.semester || '',
        startDate: c.start_date || null,
        endDate: c.end_date || null,
        enrolledCount: c.registrations?.[0]?.count || 0
      }))
    } else {
      // Các role khác (Admin, PĐT, HR) — trả mảng rỗng
      classes = []
    }

    // Lấy danh sách học kỳ duy nhất để frontend render dropdown
    const semesters = [...new Set(classes.map(c => c.semester).filter(Boolean))]

    return res.json({
      success: true,
      role: userRole,
      semesters,
      data: classes
    })
  } catch (err) {
    console.error('[TimetableController.getMyTimetable]', err.message)
    return res.status(500).json({ error: 'Không thể tải thời khoá biểu.' })
  }
}
