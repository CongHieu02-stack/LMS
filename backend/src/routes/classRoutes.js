// ============================================================================
// routes/classRoutes.js — Route definitions cho Class management
// Trách nhiệm DUY NHẤT: Ánh xạ URL → Controller handler.
// ============================================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import * as classController from '../controllers/classController.js'

const router = Router()

// Tất cả routes yêu cầu đăng nhập
router.use(authMiddleware)

// GET /api/classes — Danh sách lớp học
router.get('/', classController.listClasses)

// GET /api/classes/my-registrations — Lớp đã đăng ký của SV
router.get('/my-registrations', classController.getMyRegistrations)

// GET /api/classes/:id — Chi tiết lớp
router.get('/:id', classController.getClassById)

// POST /api/classes/register — Đăng ký vào lớp
router.post('/register', classController.registerToClass)

export { router }
