// ============================================================================
// controllers/classProposalController.js — Đề xuất & duyệt số lượng lớp
// ============================================================================

import * as classProposalModel from '../models/classProposalModel.js'

export async function getAll(req, res) {
  try {
    const proposals = await classProposalModel.findAll()
    return res.json({ success: true, data: proposals })
  } catch (err) {
    console.error('[ClassProposalController.getAll]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách đề xuất.' })
  }
}

export async function getPending(req, res) {
  try {
    const proposals = await classProposalModel.findByStatus('pending')
    return res.json({ success: true, data: proposals })
  } catch (err) {
    console.error('[ClassProposalController.getPending]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy đề xuất chờ duyệt.' })
  }
}

export async function create(req, res) {
  try {
    const { subjectId, quantity, semester, reason, maxStudents, schedule, startDate, endDate } = req.body
    if (!subjectId || !quantity || !semester) {
      return res.status(400).json({ error: 'Thiếu thông tin: subjectId, quantity, semester.' })
    }

    // Kiểm tra định dạng học kỳ: HK[1-3]-[Năm]
    const semesterRegex = /^HK([1-3])-(\d{4})$/i
    const semMatch = semester.trim().match(semesterRegex)
    if (!semMatch) {
      return res.status(400).json({ error: 'Học kỳ không đúng định dạng. Vui lòng nhập theo dạng HK[1-3]-[Năm] (ví dụ: HK1-2026).' })
    }
    const semYear = parseInt(semMatch[2])
    const currentYear = new Date().getFullYear()
    if (semYear < currentYear) {
      return res.status(400).json({ error: `Năm của học kỳ đề xuất không được trước năm ${currentYear}.` })
    }

    // Kiểm tra ràng buộc ngày tháng học vụ
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

    const proposal = await classProposalModel.create({
      subject_id: subjectId,
      proposed_by: req.user.id,
      quantity: parseInt(quantity),
      semester,
      reason: reason || '',
      max_students: maxStudents ? parseInt(maxStudents) : 50,
      schedule: schedule || '',
      start_date: startDate || null,
      end_date: endDate || null
    })
    return res
      .status(201)
      .json({ success: true, message: 'Đề xuất đã được gửi thành công.', data: proposal })
  } catch (err) {
    console.error('[ClassProposalController.create]', err.message)
    return res.status(500).json({ error: 'Lỗi khi tạo đề xuất.' })
  }
}

export async function approve(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Status không hợp lệ. Chỉ chấp nhận: approved, rejected.' })
    }
    const updated = await classProposalModel.updateStatus(id, status, req.user.id)
    return res.json({
      success: true,
      message: `Đề xuất đã được ${status === 'approved' ? 'phê duyệt' : 'từ chối'}.`,
      data: updated,
    })
  } catch (err) {
    console.error('[ClassProposalController.approve]', err.message)
    return res.status(500).json({ error: 'Lỗi khi xử lý đề xuất.' })
  }
}
