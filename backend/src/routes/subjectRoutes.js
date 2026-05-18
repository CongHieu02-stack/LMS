// ============================================================================
// routes/subjectRoutes.js — Route definitions cho Subjects
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler + middleware.
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as subjectController from '../controllers/subjectController.js'

const router = Router()

// Yêu cầu đăng nhập cho tất cả routes
router.use(authMiddleware)

// GET /api/subjects — Danh sách (Giảng viên trở lên)
router.get('/', requireRank(50), subjectController.getAll)

// PUT /api/subjects/:id/status — Duyệt môn học (Hiệu trưởng trở lên)
router.put('/:id/status', requireRank(90), subjectController.updateApproval)

export { router }
