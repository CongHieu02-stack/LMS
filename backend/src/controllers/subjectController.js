// ============================================================================
// controllers/subjectController.js — Controller quản lý môn học
// Trách nhiệm DUY NHẤT: Điều phối lấy danh sách môn học và phê duyệt môn học.
// ============================================================================

import * as subjectModel from '../models/subjectModel.js'
import * as classModel from '../models/classModel.js'
import { logActivity } from '../utils/activityLogger.js'

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
    const { status, rejection_reason } = req.body
    const actorRank = req.profile.rank

    // Kiểm tra rank
    if (actorRank < 90) {
      return res.status(403).json({ error: 'Bạn không có quyền duyệt môn học.' })
    }

    // Kiểm tra status hợp lệ
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: `Trạng thái không hợp lệ: ${status}` })
    }

    // Nếu từ chối, bắt buộc phải có lý do
    if (status === 'rejected' && (!rejection_reason || rejection_reason.trim() === '')) {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do từ chối.' })
    }

    const updatedSubject = await subjectModel.updateApproval(id, status, rejection_reason)

    await logActivity(
      req,
      status === 'approved' ? 'APPROVE_SUBJECT' : 'REJECT_SUBJECT',
      status === 'approved'
        ? `Phê duyệt môn học: ${updatedSubject.name} (${updatedSubject.code})`
        : `Từ chối môn học: ${updatedSubject.name} (${updatedSubject.code}). Lý do: ${rejection_reason}`,
      { targetType: 'subject', targetId: id },
    )

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái môn học thành công.`,
      data: updatedSubject,
    })
  } catch (err) {
    console.error('[SubjectController.updateApproval]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái môn học.' })
  }
}

/**
 * PUT /api/subjects/:id/lock — Khóa môn học.
 * Yêu cầu: rank >= 90 (Hiệu trưởng & Admin).
 */
export async function lock(req, res) {
  try {
    const { id } = req.params
    const { lock_reason } = req.body
    const actorRank = req.profile.rank

    if (actorRank < 90) {
      return res.status(403).json({ error: 'Bạn không có quyền khóa môn học.' })
    }

    if (!lock_reason || lock_reason.trim() === '') {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do khóa môn học.' })
    }

    const updatedSubject = await subjectModel.lockSubject(id, lock_reason)

    // Tự động hủy (xóa) toàn bộ lớp học của môn học này chưa hoàn thành
    await classModel.deleteActiveBySubjectId(id)

    await logActivity(
      req,
      'LOCK_SUBJECT',
      `Khóa môn học: ${updatedSubject.name} (${updatedSubject.code}). Lý do: ${lock_reason}`,
      { targetType: 'subject', targetId: id },
    )

    return res.json({
      success: true,
      message: `Đã khóa môn học thành công.`,
      data: updatedSubject,
    })
  } catch (err) {
    console.error('[SubjectController.lock]', err.message)
    return res.status(500).json({ error: 'Lỗi khi khóa môn học.' })
  }
}

/**
 * POST /api/subjects — Tạo đề xuất môn học mới.
 * Yêu cầu: rank >= 60 (PĐT & TBM trở lên).
 */
export async function create(req, res) {
  try {
    const { code, name, description, credits, department } = req.body
    if (!code || !name) {
      return res.status(400).json({ error: 'Thiếu mã môn học hoặc tên.' })
    }

    // Kiểm tra trùng mã hoặc tên môn học
    const duplicates = await subjectModel.findByCodeOrName(code, name)
    if (duplicates && duplicates.length > 0) {
      const hasCodeMatch = duplicates.some(d => d.code.trim().toUpperCase() === code.trim().toUpperCase())
      const hasNameMatch = duplicates.some(d => d.name.trim().toLowerCase() === name.trim().toLowerCase())
      
      if (hasCodeMatch) {
        return res.status(409).json({ error: 'Mã môn học đã tồn tại trong hệ thống.' })
      }
      if (hasNameMatch) {
        return res.status(409).json({ error: 'Tên môn học đã tồn tại trong hệ thống.' })
      }
    }

    const subject = await subjectModel.create({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description || '',
      credits: parseInt(credits) || 3,
      department: department || 'Khoa Công nghệ thông tin',
      creator_id: req.user.id,
      status: 'pending',
    })

    await logActivity(
      req,
      'PROPOSE_SUBJECT',
      `Đề xuất môn học mới: ${name} (${code.toUpperCase()})`,
      { targetType: 'subject', targetId: subject.id },
    )

    return res.status(201).json({
      success: true,
      message: 'Đề xuất môn học đã được gửi tới Hiệu trưởng để phê duyệt.',
      data: subject,
    })
  } catch (err) {
    console.error('[SubjectController.create]', err.message)
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return res.status(409).json({ error: `Mã môn học đã tồn tại.` })
    }
    return res.status(500).json({ error: 'Lỗi khi tạo đề xuất môn học.' })
  }
}

/**
 * PUT /api/subjects/:id/unlock — Mở khóa môn học.
 * Yêu cầu: rank >= 90 (Hiệu trưởng & Admin).
 */
export async function unlock(req, res) {
  try {
    const { id } = req.params
    const actorRank = req.profile.rank

    if (actorRank < 90) {
      return res.status(403).json({ error: 'Bạn không có quyền mở khóa môn học.' })
    }

    const updatedSubject = await subjectModel.unlockSubject(id)

    await logActivity(
      req,
      'UNLOCK_SUBJECT',
      `Mở khóa môn học: ${updatedSubject.name} (${updatedSubject.code})`,
      { targetType: 'subject', targetId: id },
    )

    return res.json({
      success: true,
      message: `Đã mở khóa môn học thành công.`,
      data: updatedSubject,
    })
  } catch (err) {
    console.error('[SubjectController.unlock]', err.message)
    return res.status(500).json({ error: 'Lỗi khi mở khóa môn học.' })
  }
}

