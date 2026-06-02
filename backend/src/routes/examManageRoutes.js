// ============================================================================
// routes/examManageRoutes.js — CRUD bài kiểm tra (GV quản lý)
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requireRank } from '../middleware/authMiddleware.js'
import * as ctrl from '../controllers/examManageController.js'

const router = Router()
router.use(authMiddleware)

// GET /api/exam-manage/class/:classId — Bài KT theo lớp (GV+)
router.get('/class/:classId', requireRank(50), ctrl.getByClass)

// GET /api/exam-manage/published/:classId — Bài KT đã publish (SV xem)
router.get('/published/:classId', ctrl.getPublishedByClass)

// GET /api/exam-manage/submissions/:classId — Lấy danh sách bài nộp để chấm (GV+)
router.get('/submissions/:classId', requireRank(50), ctrl.getSubmissionsForClass)

// POST /api/exam-manage/grade — Chấm điểm bài làm của sinh viên (GV+)
router.post('/grade', requireRank(50), ctrl.gradeSubmission)

// GET /api/exam-manage/:id — Chi tiết bài KT
router.get('/:id', ctrl.getById)

// POST /api/exam-manage — Tạo bài KT (GV+)
router.post('/', requireRank(50), ctrl.create)

// PUT /api/exam-manage/:id — Sửa bài KT
router.put('/:id', requireRank(50), ctrl.update)

// DELETE /api/exam-manage/:id — Xóa
router.delete('/:id', requireRank(50), ctrl.remove)

export { router }
