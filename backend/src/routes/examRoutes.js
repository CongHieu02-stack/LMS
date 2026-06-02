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

// POST /api/exam/upload — Tải file bài làm tự luận
router.post('/upload', examController.uploadSubmissionFile)

// GET /api/exam/my-submissions — Bài nộp của SV hiện tại
router.get('/my-submissions', examController.getMySubmissions)

export { router }
