// ============================================================================
// routes/index.js — Route Aggregator
// Trách nhiệm DUY NHẤT: Gom tất cả route groups vào một router duy nhất.
// KHÔNG chứa logic handler hay middleware riêng.
// ============================================================================

import { Router } from 'express'
import { router as authRoutes } from './authRoutes.js'
import { router as profileRoutes } from './profileRoutes.js'
import { router as classRoutes } from './classRoutes.js'
import { router as examRoutes } from './examRoutes.js'
import { router as subjectRoutes } from './subjectRoutes.js'
import { router as configRoutes } from './configRoutes.js'

const router = Router()

// Mount từng nhóm route dưới prefix tương ứng
router.use('/auth', authRoutes)
router.use('/profiles', profileRoutes)
router.use('/classes', classRoutes)
router.use('/exam', examRoutes)
router.use('/subjects', subjectRoutes)
router.use('/configs', configRoutes)

export { router }

