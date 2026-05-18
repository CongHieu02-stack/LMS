// ============================================================================
// controllers/configController.js — Controller quản lý cấu hình trường
// Trách nhiệm DUY NHẤT: Lấy danh sách cấu hình và cập nhật giá trị cấu hình.
// ============================================================================

import * as configModel from '../models/configModel.js'

/**
 * GET /api/configs — Lấy toàn bộ cấu hình trường học.
 * Yêu cầu: rank >= 10 (Ai đã đăng nhập cũng xem được).
 */
export async function getAll(req, res) {
  try {
    const configs = await configModel.findAll()
    return res.json({ success: true, data: configs })
  } catch (err) {
    console.error('[ConfigController.getAll]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy thông tin cấu hình trường.' })
  }
}

/**
 * PUT /api/configs/:key — Cập nhật một tham số cấu hình.
 * Yêu cầu: rank >= 90 (Hiệu trưởng & Admin).
 */
export async function updateConfig(req, res) {
  try {
    const { key } = req.params
    const { value } = req.body
    const actorRank = req.profile.rank

    // Kiểm tra rank tối thiểu
    if (actorRank < 90) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý cấu hình trường học.' })
    }

    if (value === undefined) {
      return res.status(400).json({ error: 'Thiếu giá trị value cấu hình.' })
    }

    const updated = await configModel.update(key, String(value))
    return res.json({
      success: true,
      message: `Cập nhật cấu hình "${key}" thành công.`,
      data: updated
    })
  } catch (err) {
    console.error('[ConfigController.updateConfig]', err.message)
    return res.status(500).json({ error: 'Lỗi khi cập nhật cấu hình.' })
  }
}
