// ============================================================================
// routes/lessonRoutes.js — CRUD bài học
// ============================================================================

import { Router } from 'express'
import { authMiddleware, requirePermissionOrRank } from '../middleware/authMiddleware.js'
import * as ctrl from '../controllers/lessonController.js'

const router = Router()
router.use(authMiddleware)

// POST /api/lessons/upload — Tải lên file (GV trở lên, rank >= 50)
router.post('/upload', requirePermissionOrRank('lesson_exam_manage', 50), ctrl.upload.single('file'), ctrl.uploadFile)

// GET /api/lessons/class/:classId — Lấy bài học theo lớp
router.get('/class/:classId', ctrl.getByClass)

// POST /api/lessons — Tạo bài học (GV trở lên, rank >= 50)
router.post('/', requirePermissionOrRank('lesson_exam_manage', 50), ctrl.create)

// PUT /api/lessons/:id — Sửa bài học
router.put('/:id', requirePermissionOrRank('lesson_exam_manage', 50), ctrl.update)

// DELETE /api/lessons/:id — Xóa bài học
router.delete('/:id', requirePermissionOrRank('lesson_exam_manage', 50), ctrl.remove)

export { router }
