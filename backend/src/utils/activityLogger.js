// ============================================================================
// utils/activityLogger.js — Tiện ích ghi log hoạt động của Admin
// Trách nhiệm DUY NHẤT: Trích xuất thông tin admin từ request và ghi log.
// Bảng đích: admin_activity_logs
// ============================================================================

import * as activityLogModel from '../models/activityLogModel.js'

/**
 * Ghi nhận hoạt động của admin
 * @param {object} req - Express Request object (cần req.profile.id)
 * @param {string} actionType - Loại hành động (vd: 'UPDATE_ROLE', 'LOCK_USER')
 * @param {string} description - Mô tả chi tiết hành động
 * @param {object} [options] - Tùy chọn bổ sung
 * @param {string} [options.targetType] - Loại đối tượng bị tác động ('user', 'class', 'subject', 'department')
 * @param {string} [options.targetId] - UUID đối tượng bị tác động
 * @param {object} [options.metadata] - Dữ liệu phụ (JSONB)
 */
export async function logActivity(req, actionType, description, options = {}) {
  try {
    const adminId = req.profile?.id || req.user?.id
    if (!adminId) {
      console.warn('[ActivityLogger] Không thể xác định adminId từ request để ghi log:', actionType)
      return
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || ''
    const userAgent = req.headers['user-agent'] || ''

    const metadata = {
      ...(options.metadata || {}),
      ip,
      userAgent
    }

    await activityLogModel.createLog({
      adminId,
      actionType,
      targetType: options.targetType || 'SYSTEM',
      targetId: options.targetId || null,
      description: description || 'Thao tác hệ thống',
      metadata
    })
  } catch (error) {
    // Không làm crash request chính nếu ghi log thất bại
    console.error('[ActivityLogger Error] Không thể lưu log hoạt động:', error.message)
  }
}
