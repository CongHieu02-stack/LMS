// ============================================================================
// controllers/classController.js — Controller quản lý lớp học
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ lớp học và đăng ký.
// Gọi Model (classModel) để truy vấn, gọi View (classView) để format.
// ============================================================================

import * as classModel from '../models/classModel.js'
import * as classView from '../views/classView.js'
import * as profileModel from '../models/profileModel.js'

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

    let finalManagerId = managerId || null
    if (!finalManagerId) {
      const { supabaseAdmin } = await import('../config/supabase.js')
      const { data: subj } = await supabaseAdmin
        .from('subjects')
        .select('department')
        .eq('id', subjectId)
        .single()
      
      if (subj?.department) {
        const { data: tbm } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('role', 'TRUONG_BO_MON')
          .eq('department', subj.department)
          .limit(1)
          .maybeSingle()
        if (tbm) {
          finalManagerId = tbm.id
        }
      }
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
      manager_id: finalManagerId
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

    // 1. Lấy thông tin lớp học để kiểm tra khoa
    const classData = await classModel.findById(req.params.id)
    if (!classData) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học.' })
    }

    // 2. Lấy thông tin giảng viên để kiểm tra khoa
    const instructorData = await profileModel.findById(instructorId)
    if (!instructorData) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên.' })
    }

    // 3. Ràng buộc khoa cho Trưởng bộ môn (rank === 60 hoặc role === 'TRUONG_BO_MON')
    if (req.profile.role === 'TRUONG_BO_MON') {
      const userDept = req.profile.department
      const classDept = classData.subject?.department

      if (!userDept) {
        return res.status(403).json({ error: 'Tài khoản Trưởng bộ môn chưa được gán khoa phụ trách.' })
      }

      if (classDept !== userDept) {
        return res.status(403).json({
          error: `Bạn chỉ có quyền phân công giảng viên cho các lớp thuộc ${userDept}.`
        })
      }
    }

    const updated = await classModel.assignInstructor(req.params.id, instructorId)
    return res.json({ success: true, message: 'Phân công giảng viên thành công.', data: updated })
  } catch (err) {
    console.error('[ClassController.assignInstructor]', err.message)
    return res.status(500).json({ error: 'Lỗi khi phân công giảng viên.' })
  }
}


/**
 * PUT /api/classes/:id/approve — Duyệt mở lớp. Hỗ trợ tự động xếp phòng hoặc chỉ định phòng cụ thể.
 */
export async function approveClass(req, res) {
  try {
    const { id } = req.params
    const { maxStudents, schedule, roomName, startDate, endDate } = req.body

    if (!maxStudents || parseInt(maxStudents) <= 0) {
      return res.status(400).json({ error: 'Số lượng sinh viên tối đa phải lớn hơn 0.' })
    }

    // Kiểm tra ràng buộc ngày tháng
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Định dạng ngày tháng không hợp lệ.' })
      }

      if (end < start) {
        return res.status(400).json({ error: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.' })
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const minStartDate = new Date(today)
      minStartDate.setDate(minStartDate.getDate() + 14)

      start.setHours(0, 0, 0, 0)
      if (start < minStartDate) {
        return res.status(400).json({ error: 'Ngày bắt đầu phải cách ngày hiện tại ít nhất 2 tuần (14 ngày).' })
      }
    }

    const { supabaseAdmin } = await import('../config/supabase.js')

    // 1. Lưu lịch học và ngày tháng học vụ trước (hoặc thiết lập null nếu không nhập)
    const finalSchedule = schedule && schedule.trim() ? schedule.trim() : null
    const updatePayload = { 
      schedule: finalSchedule, 
      updated_at: new Date().toISOString() 
    }
    if (startDate) updatePayload.start_date = startDate
    if (endDate) updatePayload.end_date = endDate

    const { error: schedErr } = await supabaseAdmin
      .from('classes')
      .update(updatePayload)
      .eq('id', id)

    if (schedErr) {
      return res.status(500).json({ error: `Lỗi khi lưu lịch học & thời gian: ${schedErr.message}` })
    }

    // 2. Kiểm tra nếu chỉ định phòng học cụ thể
    if (roomName && roomName.trim() && roomName.trim() !== 'auto') {
      const trimmedRoom = roomName.trim()

      // Kiểm tra trùng lịch phòng học
      const { data: overlapData, error: overlapErr } = await supabaseAdmin
        .rpc('check_room_overlap_for_approve', {
          p_room_name: trimmedRoom,
          p_schedule: finalSchedule || '',
          p_class_id: id
        })

      if (overlapErr) {
        console.warn('[ClassController.approveClass] check_room_overlap_for_approve error, fallback to warning only', overlapErr)
      } else if (overlapData && overlapData.has_overlap) {
        return res.status(400).json({ error: `Phòng học ${trimmedRoom} đã bị trùng lịch với lớp khác trong thời gian này!` })
      }

      // Lấy capacity của phòng
      const { data: roomObj, error: roomErr } = await supabaseAdmin
        .from('rooms')
        .select('id, name, capacity')
        .eq('name', trimmedRoom)
        .maybeSingle()

      if (roomErr) {
        return res.status(500).json({ error: `Lỗi khi kiểm tra thông tin phòng: ${roomErr.message}` })
      }

      if (roomObj) {
        if (parseInt(maxStudents) > roomObj.capacity) {
          return res.status(400).json({
            error: `Sức chứa của phòng ${trimmedRoom} (${roomObj.capacity} chỗ) nhỏ hơn sĩ số tối đa yêu cầu (${maxStudents}).`
          })
        }
      }

      const roomId = roomObj ? roomObj.id : null

      // Duyệt trực tiếp với phòng được chọn
      const { data: updatedClass, error: updateErr } = await supabaseAdmin
        .from('classes')
        .update({
          status: 'APPROVED',
          room_id: roomId,
          room: trimmedRoom,
          max_students: parseInt(maxStudents),
          max_slots: parseInt(maxStudents),
          remaining_slots: parseInt(maxStudents),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (updateErr) {
        return res.status(500).json({ error: `Lỗi khi duyệt mở lớp: ${updateErr.message}` })
      }

      return res.json({
        success: true,
        message: `Duyệt lớp học và gán phòng ${trimmedRoom} thành công.`,
        data: updatedClass
      })
    } else {
      // Tự động xếp phòng ngẫu nhiên
      const result = await classModel.approveClassAndRandomRoom(id, parseInt(maxStudents))
      return res.json({
        success: true,
        message: `Duyệt lớp học và tự động xếp phòng thành công.`,
        data: result
      })
    }
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
 * GET /api/classes/rooms — Lấy danh sách phòng học.
 */
export async function listRooms(req, res) {
  try {
    const { supabaseAdmin } = await import('../config/supabase.js')
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('id, name, capacity')
      .order('name', { ascending: true })

    if (error) throw error

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    console.error('[ClassController.listRooms]', err.message)
    return res.status(500).json({ error: 'Không thể tải danh sách phòng học.' })
  }
}


