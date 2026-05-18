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
