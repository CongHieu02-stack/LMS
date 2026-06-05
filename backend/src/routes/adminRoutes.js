// ============================================================================
// routes/adminRoutes.js — Route definitions cho hành động Admin tập trung
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// Yêu cầu đăng nhập cho tất cả các thao tác admin
router.use(authMiddleware)

// POST /api/admin/action — Thực hiện các hành động phê duyệt, từ chối, khóa
router.post('/action', adminController.handleAdminAction)

// GET /api/admin/activity-logs — Lấy danh sách lịch sử hoạt động (Chỉ ADMIN)
router.get('/activity-logs', requireRank(100), adminController.getActivityLogs)

export { router }
