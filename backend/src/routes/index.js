// ============================================================================
// routes/index.js — Route Aggregator
// Trách nhiệm DUY NHẤT: Gom tất cả route groups vào một router duy nhất.
// ============================================================================

import { Router } from 'express'
import { router as authRoutes } from './authRoutes.js'
import { router as profileRoutes } from './profileRoutes.js'
import { router as classRoutes } from './classRoutes.js'
import { router as examRoutes } from './examRoutes.js'
import { router as subjectRoutes } from './subjectRoutes.js'
import { router as configRoutes } from './configRoutes.js'
import { router as classProposalRoutes } from './classProposalRoutes.js'
import { router as lessonRoutes } from './lessonRoutes.js'
import { router as examManageRoutes } from './examManageRoutes.js'
import { router as gradeRoutes } from './gradeRoutes.js'
import { router as adminRoutes } from './adminRoutes.js'

const router = Router()

// Mount từng nhóm route dưới prefix tương ứng
router.use('/auth', authRoutes)
router.use('/profiles', profileRoutes)
router.use('/classes', classRoutes)
router.use('/exam', examRoutes)
router.use('/subjects', subjectRoutes)
router.use('/configs', configRoutes)
router.use('/class-proposals', classProposalRoutes)
router.use('/lessons', lessonRoutes)
router.use('/exam-manage', examManageRoutes)
router.use('/grades', gradeRoutes)
router.use('/admin', adminRoutes)

export { router }
