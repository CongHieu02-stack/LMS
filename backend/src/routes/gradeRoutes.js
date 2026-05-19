// ============================================================================
// routes/gradeRoutes.js — Bảng điểm
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as ctrl from '../controllers/gradeController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/grades/me — Điểm của SV đang đăng nhập
router.get('/me', ctrl.getMyGrades)

// GET /api/grades/class/:classId — Điểm theo lớp (GV+)
router.get('/class/:classId', requireRank(50), ctrl.getByClass)

// POST /api/grades — GV chấm điểm
router.post('/', requireRank(50), ctrl.saveGrade)

export { router }
