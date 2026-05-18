// ============================================================================
// controllers/examController.js — Controller nộp bài thi
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ nộp bài (bình thường + bắt buộc).
// Gọi Model (examModel) để lưu, gọi View (examView) để format.
// ============================================================================

import * as examModel from '../models/examModel.js'
import * as examView from '../views/examView.js'

/**
 * POST /api/exam/submit — Nộp bài thi.
 * Body: { examTitle, answers: [...], isForced: boolean, violations: number }
 */
export async function submitExam(req, res) {
  try {
    const { examTitle, answers, isForced, violations } = req.body
    const studentId = req.user.id

    // Validate input cơ bản
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Dữ liệu bài làm không hợp lệ.' })
    }

    // Gọi Model để lưu
    const submission = await examModel.saveSubmission({
      student_id: studentId,
      exam_title: examTitle,
      answers,
      is_forced: isForced || false,
      violations: violations || 0
    })

    // Log nếu là nộp bắt buộc (do gian lận)
    if (isForced) {
      console.warn(
        `[ANTI-CHEAT] Nộp bài bắt buộc: student=${studentId}, violations=${violations}, exam="${examTitle}"`
      )
    }

    // Format response qua View
    return res.json(examView.formatSubmissionResult(submission))
  } catch (err) {
    console.error('[ExamController.submitExam]', err.message)
    return res.status(500).json({ error: 'Lỗi khi nộp bài thi.' })
  }
}

/**
 * GET /api/exam/my-submissions — Lấy bài nộp của sinh viên hiện tại.
 */
export async function getMySubmissions(req, res) {
  try {
    const submissions = await examModel.findByStudent(req.user.id)
    return res.json(examView.formatSubmissionList(submissions))
  } catch (err) {
    console.error('[ExamController.getMySubmissions]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bài nộp.' })
  }
}
