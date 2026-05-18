// ============================================================================
// routes/configRoutes.js — Route definitions cho School Config
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler + middleware.
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as configController from '../controllers/configController.js'

const router = Router()

// Yêu cầu đăng nhập cho tất cả
router.use(authMiddleware)

// GET /api/configs — Xem cấu hình (tất cả học viên, giảng viên...)
router.get('/', requireRank(10), configController.getAll)

// PUT /api/configs/:key — Cập nhật cấu hình (Hiệu trưởng trở lên)
router.put('/:key', requireRank(90), configController.updateConfig)

export { router }
