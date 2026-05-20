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
    const { subjectId, quantity, semester, reason } = req.body
    if (!subjectId || !quantity || !semester) {
      return res.status(400).json({ error: 'Thiếu thông tin: subjectId, quantity, semester.' })
    }
    const proposal = await classProposalModel.create({
      subject_id: subjectId,
      proposed_by: req.user.id,
      quantity: parseInt(quantity),
      semester,
      reason: reason || '',
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
