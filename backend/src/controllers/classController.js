// ============================================================================
// controllers/classController.js — Controller quản lý lớp học
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ lớp học và đăng ký.
// Gọi Model (classModel) để truy vấn, gọi View (classView) để format.
// ============================================================================

import * as classModel from '../models/classModel.js'
import * as classView from '../views/classView.js'

/**
 * GET /api/classes — Lấy danh sách tất cả lớp học đang hoạt động.
 */
export async function listClasses(req, res) {
  try {
    const classes = await classModel.findAll()
    return res.json(classView.formatClassList(classes))
  } catch (err) {
    console.error('[ClassController.listClasses]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách lớp.' })
  }
}

/**
 * GET /api/classes/:id — Lấy chi tiết một lớp học.
 */
export async function getClassById(req, res) {
  try {
    const classData = await classModel.findById(req.params.id)
    if (!classData) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học.' })
    }
    return res.json({ success: true, class: classView.formatClass(classData) })
  } catch (err) {
    console.error('[ClassController.getClassById]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy thông tin lớp.' })
  }
}

/**
 * POST /api/classes/register — Đăng ký sinh viên vào lớp.
 * Sử dụng RPC register_student_to_class (có FOR UPDATE chống race condition).
 */
export async function registerToClass(req, res) {
  try {
    const { classId } = req.body
    const studentId = req.user.id

    // Validate input
    if (!classId) {
      return res.status(400).json({ error: 'Thiếu classId.' })
    }

    // Gọi Model → RPC Supabase
    const result = await classModel.registerStudent(classId, studentId)

    // Format response qua View
    const formatted = classView.formatRegistrationResult(result)

    // Trả status code phù hợp
    const statusCode = formatted.success ? 200 : 409
    return res.status(statusCode).json(formatted)
  } catch (err) {
    console.error('[ClassController.registerToClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi đăng ký lớp.' })
  }
}

/**
 * GET /api/classes/my-registrations — Lấy lớp đã đăng ký của sinh viên hiện tại.
 */
export async function getMyRegistrations(req, res) {
  try {
    const registrations = await classModel.findRegistrationsByStudent(req.user.id)
    return res.json(classView.formatStudentRegistrations(registrations))
  } catch (err) {
    console.error('[ClassController.getMyRegistrations]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách đăng ký.' })
  }
}

/**
 * POST /api/classes — Tạo lớp học mới (PĐT tạo).
 */
export async function createClass(req, res) {
  try {
    const { subjectId, name, maxSlots, schedule, room, semester, managerId } = req.body
    if (!subjectId || !name || !maxSlots) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: subjectId, name, maxSlots.' })
    }
    const newClass = await classModel.create({
      subject_id: subjectId,
      code: name,
      name,
      max_slots: parseInt(maxSlots),
      max_students: parseInt(maxSlots),
      remaining_slots: parseInt(maxSlots),
      schedule: schedule || '',
      room: room || '',
      semester: semester || '',
      manager_id: managerId || null
    })
    return res.status(201).json({ success: true, message: 'Tạo lớp học thành công.', data: newClass })
  } catch (err) {
    console.error('[ClassController.createClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo lớp học.' })
  }
}

/**
 * PUT /api/classes/:id/instructor — Phân công giảng viên vào lớp.
 */
export async function assignInstructor(req, res) {
  try {
    const { instructorId } = req.body
    if (!instructorId) {
      return res.status(400).json({ error: 'Thiếu instructorId.' })
    }
    const updated = await classModel.assignInstructor(req.params.id, instructorId)
    return res.json({ success: true, message: 'Phân công giảng viên thành công.', data: updated })
  } catch (err) {
    console.error('[ClassController.assignInstructor]', err.message)
    return res.status(500).json({ error: 'Lỗi khi phân công giảng viên.' })
  }
}

/**
 * PUT /api/classes/:id/approve — Duyệt mở lớp và tự động xếp phòng ngẫu nhiên.
 */
export async function approveClass(req, res) {
  try {
    const { id } = req.params
    const { maxStudents, schedule } = req.body

    if (!maxStudents || parseInt(maxStudents) <= 0) {
      return res.status(400).json({ error: 'Số lượng sinh viên tối đa phải lớn hơn 0.' })
    }

    // Nếu PĐT nhập lịch học, cập nhật vào DB trước khi gọi RPC tìm phòng
    // (RPC đọc schedule từ DB để kiểm tra trùng lịch)
    if (schedule && schedule.trim()) {
      const { supabaseAdmin } = await import('../config/supabase.js')
      const { error: schedErr } = await supabaseAdmin
        .from('classes')
        .update({ schedule: schedule.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (schedErr) {
        return res.status(500).json({ error: `Lỗi khi lưu lịch học: ${schedErr.message}` })
      }
    }

    const result = await classModel.approveClassAndRandomRoom(id, parseInt(maxStudents))

    // Tự động chuyển đổi trạng thái thành open_for_reg sau khi được phê duyệt để cho sinh viên đăng ký
    const { supabaseAdmin } = await import('../config/supabase.js')
    await supabaseAdmin
      .from('classes')
      .update({ status: 'open_for_reg', updated_at: new Date().toISOString() })
      .eq('id', id)
    
    return res.json({
      success: true,
      message: `Duyệt lớp học và xếp phòng tự động thành công.`,
      data: { ...result, status: 'open_for_reg' }
    })
  } catch (err) {
    console.error('[ClassController.approveClass]', err.message)
    return res.status(400).json({ error: err.message || 'Lỗi khi duyệt lớp học.' })
  }
}

/**
 * PUT /api/classes/:id/reject — Từ chối mở lớp.
 */
export async function rejectClass(req, res) {
  try {
    const { id } = req.params
    const { supabaseAdmin } = await import('../config/supabase.js')
    const { data, error } = await supabaseAdmin
      .from('classes')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return res.json({
      success: true,
      message: 'Từ chối mở lớp học thành công.',
      data
    })
  } catch (err) {
    console.error('[ClassController.rejectClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi từ chối mở lớp.' })
  }
}

/**
 * PUT /api/classes/:id/complete — Hoàn thành lớp học (GV+)
 */
export async function completeClass(req, res) {
  try {
    const { id } = req.params
    const { supabaseAdmin } = await import('../config/supabase.js')
    const { data, error } = await supabaseAdmin
      .from('classes')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return res.json({
      success: true,
      message: 'Lớp học đã được đánh dấu hoàn thành.',
      data
    })
  } catch (err) {
    console.error('[ClassController.completeClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi hoàn thành lớp học.' })
  }
}


