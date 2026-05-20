// ============================================================================
// controllers/adminController.js — Controller xử lý các hành động tập trung của Admin
// Gọi RPC handle_admin_action trong database Supabase
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

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

    return res.json({ success: true, message: 'Thực hiện hành động quản trị thành công.', data })
  } catch (err) {
    console.error('[AdminController.handleAdminAction]', err.message)
    return res.status(500).json({ error: 'Lỗi khi thực hiện hành động quản trị.' })
  }
}
