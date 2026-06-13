// ============================================================================
// routes/examRoutes.js — Route definitions cho Exam management
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler.
// ============================================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import * as examController from '../controllers/examController.js'

const router = Router()

// Tất cả routes yêu cầu đăng nhập
router.use(authMiddleware)

// POST /api/exam/submit — Nộp bài thi
router.post('/submit', examController.submitExam)

// GET /api/exam/my-submissions — Bài nộp của SV hiện tại
router.get('/my-submissions', examController.getMySubmissions)

// GET /api/exam/submission/:id — Chi tiết bài nộp của SV
router.get('/submission/:id', examController.getSubmissionDetail)

export { router }
