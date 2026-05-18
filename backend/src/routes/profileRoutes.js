// ============================================================================
// routes/profileRoutes.js — Route definitions cho Profile management
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler + middleware.
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as profileController from '../controllers/profileController.js'

const router = Router()

// Tất cả routes yêu cầu đăng nhập
router.use(authMiddleware)

// GET /api/profiles — Danh sách (Giảng viên trở lên)
router.get('/', requireRank(50), profileController.getAll)

// GET /api/profiles/:id — Chi tiết
router.get('/:id', profileController.getById)

// PUT /api/profiles/:id — Cập nhật thông tin cá nhân
router.put('/:id', profileController.updateInfo)

// POST /api/profiles — Tạo mới tài khoản (HR trở lên)
router.post('/', requireRank(80), profileController.createProfile)

// PUT /api/profiles/:id/role — Cập nhật role (HR trở lên)
router.put('/:id/role', requireRank(80), profileController.updateRole)

// DELETE /api/profiles/:id — Xóa (HR trở lên)
router.delete('/:id', requireRank(80), profileController.deleteProfile)

export { router }

