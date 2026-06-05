// ============================================================================
// controllers/adminController.js — Controller xử lý các hành động tập trung của Admin
// Gọi RPC handle_admin_action trong database Supabase
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'
import * as activityLogModel from '../models/activityLogModel.js'
import { logActivity } from '../utils/activityLogger.js'

export async function handleAdminAction(req, res) {
  try {
    const { entity, targetId, action, reason } = req.body
    
    if (!entity || !targetId || !action) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: entity, targetId, action.' })
    }

    if (['TU_CHOI', 'KHOA'].includes(action) && (!reason || reason.trim() === '')) {
      return res.status(400).json({ error: 'Từ chối hoặc Khóa bắt buộc phải nhập lý do.' })
    }

    // Gọi RPC handle_admin_action trong database
    const { data, error } = await supabaseAdmin.rpc('handle_admin_action', {
      p_entity: entity,
      p_target_id: targetId,
      p_action: action,
      p_reason: reason || null
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Ghi nhận lịch sử hoạt động Admin thành công
    const entityLabels = { subject: 'môn học', class: 'lớp học', department: 'bộ môn' }
    const actionLabels = { DUYET: 'Phê duyệt', TU_CHOI: 'Từ chối duyệt', KHOA: 'Khóa' }
    
    const entityLabel = entityLabels[entity] || entity
    const actionLabel = actionLabels[action] || action
    const logDetails = `${actionLabel} ${entityLabel} (ID: ${targetId})${reason ? `. Lý do: ${reason}` : ''}`
    
    await logActivity(req, 'ADMIN_ACTION', logDetails)

    return res.json({ success: true, message: 'Thực hiện hành động quản trị thành công.', data })
  } catch (err) {
    console.error('[AdminController.handleAdminAction]', err.message)
    return res.status(500).json({ error: 'Lỗi khi thực hiện hành động quản trị.' })
  }
}

export async function getActivityLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    const logs = await activityLogModel.findAllLogs({ limit, offset })
    
    // Định dạng lại kết quả để frontend dễ sử dụng
    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action_type,
      details: log.description,
      ipAddress: log.metadata?.ip || 'N/A',
      userAgent: log.metadata?.userAgent || 'N/A',
      createdAt: log.created_at,
      email: log.profiles?.email || 'N/A',
      fullName: log.profiles?.full_name || 'N/A',
      role: log.profiles?.role || 'N/A'
    }))

    return res.json({ success: true, data: formattedLogs })
  } catch (err) {
    console.error('[AdminController.getActivityLogs]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách lịch sử hoạt động.' })
  }
}

