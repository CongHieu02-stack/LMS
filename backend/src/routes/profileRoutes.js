// ============================================================================
// routes/profileRoutes.js — Route definitions cho Profile management
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler + middleware.
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requirePermissionOrRank } from '../middleware/authMiddleware.js'
import * as profileController from '../controllers/profileController.js'

const router = Router()

// Tất cả routes yêu cầu đăng nhập
router.use(authMiddleware)

// GET /api/profiles — Danh sách (Giảng viên trở lên HOẶC có quyền user_manage_staff)
router.get('/', requirePermissionOrRank('user_manage_staff', 50), profileController.getAll)

// GET /api/profiles/:id — Chi tiết
router.get('/:id', profileController.getById)

// PUT /api/profiles/:id — Cập nhật thông tin cá nhân
router.put('/:id', profileController.updateInfo)

// POST /api/profiles — Tạo mới tài khoản (HR trở lên HOẶC có quyền user_manage_staff)
router.post('/', requirePermissionOrRank('user_manage_staff', 80), profileController.createProfile)

// PUT /api/profiles/:id/role — Cập nhật role (HR trở lên HOẶC có quyền user_manage_staff)
router.put(
  '/:id/role',
  requirePermissionOrRank('user_manage_staff', 80),
  profileController.updateRole,
)

// DELETE /api/profiles/:id — Xóa (HR trở lên HOẶC có quyền user_manage_staff)
router.delete(
  '/:id',
  requirePermissionOrRank('user_manage_staff', 80),
  profileController.deleteProfile,
)

export { router }
