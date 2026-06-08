// ============================================================================
// routes/timetableRoutes.js — Route definitions cho Thời Khoá Biểu
// ============================================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import * as timetableController from '../controllers/timetableController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/timetable/me — Thời khoá biểu của user đang đăng nhập
router.get('/me', timetableController.getMyTimetable)

export { router }
