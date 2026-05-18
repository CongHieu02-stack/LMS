// ============================================================================
// routes/authRoutes.js — Route definitions cho Authentication
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler.
// KHÔNG chứa logic nghiệp vụ hay truy vấn DB.
// ============================================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import * as authController from '../controllers/authController.js'

const router = Router()

// GET /api/auth/me — Lấy thông tin user đang đăng nhập
router.get('/me', authMiddleware, authController.getMe)

export { router }
