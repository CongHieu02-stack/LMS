// ============================================================================
// controllers/subjectController.js — Controller quản lý môn học
// Trách nhiệm DUY NHẤT: Điều phối lấy danh sách môn học và phê duyệt môn học.
// ============================================================================

import * as subjectModel from '../models/subjectModel.js'

/**
 * GET /api/subjects — Lấy danh sách tất cả môn học.
 * Yêu cầu: rank >= 50.
 */
export async function getAll(req, res) {
  try {
    const subjects = await subjectModel.findAll()
    return res.json({ success: true, data: subjects })
  } catch (err) {
    console.error('[SubjectController.getAll]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách môn học.' })
  }
}

/**
 * PUT /api/subjects/:id/status — Cập nhật trạng thái phê duyệt (Duyệt môn).
 * Yêu cầu: rank >= 90 (Hiệu trưởng & Admin).
 */
export async function updateApproval(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    const actorRank = req.profile.rank

    // Kiểm tra rank
    if (actorRank < 90) {
      return res.status(403).json({ error: 'Bạn không có quyền duyệt môn học.' })
    }

    // Kiểm tra status hợp lệ
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: `Trạng thái không hợp lệ: ${status}` })
    }

    const updatedSubject = await subjectModel.updateApproval(id, status)
    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái môn học thành công.`,
      data: updatedSubject
    })
  } catch (err) {
    console.error('[SubjectController.updateApproval]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái môn học.' })
  }
}
