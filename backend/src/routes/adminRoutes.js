// ============================================================================
// routes/adminRoutes.js — Route definitions cho hành động Admin tập trung
// ============================================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// Yêu cầu đăng nhập cho tất cả các thao tác admin
router.use(authMiddleware)

// POST /api/admin/action — Thực hiện các hành động phê duyệt, từ chối, khóa
router.post('/action', adminController.handleAdminAction)

export { router }
