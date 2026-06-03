// ============================================================================
// controllers/examController.js — Controller nộp bài thi
// Trách nhiệm DUY NHẤT: Điều phối nghiệp vụ nộp bài (bình thường + bắt buộc).
// Gọi Model (examModel) để lưu, gọi View (examView) để format.
// ============================================================================

import * as examModel from '../models/examModel.js'
import * as examView from '../views/examView.js'
import * as examManageModel from '../models/examManageModel.js'
import * as gradeModel from '../models/gradeModel.js'

/**
 * POST /api/exam/submit — Nộp bài thi.
 * Body: { examTitle, examId, classId, answers: [...], isForced: boolean, violations: number }
 */
export async function submitExam(req, res) {
  try {
    const { examTitle, examId, classId, answers, isForced, violations } = req.body
    const studentId = req.user.id

    // Validate input cơ bản
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Dữ liệu bài làm không hợp lệ.' })
    }

    // Gọi Model để lưu bài nộp
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

    // Tự động tính điểm và lưu vào grades table
    let score = 0
    console.log('[AUTO-GRADE] Starting auto-grade process, examId:', examId, 'isForced:', isForced)
    if (examId && !isForced) {
      try {
        // Lấy thông tin exam từ database để có đáp án đúng
        const exam = await examManageModel.findById(examId)
        console.log('[AUTO-GRADE] Exam found:', exam ? 'yes' : 'no', 'questions:', exam?.questions?.length || 0)
        if (exam && exam.questions) {
          // Tính điểm: số câu đúng / tổng số câu * 10
          let correct = 0
          exam.questions.forEach((q) => {
            const studentAnswer = answers.find(a => a.question_id === q.id)
            if (studentAnswer && studentAnswer.selected_option === q.answer) {
              correct++
            }
          })
          score = exam.questions.length > 0 ? parseFloat(((correct / exam.questions.length) * 10).toFixed(1)) : 0
          console.log('[AUTO-GRADE] Calculated score:', score, 'correct:', correct, 'total:', exam.questions.length)

          // Lưu điểm vào grades table
          const gradeResult = await gradeModel.upsert({
            exam_id: examId,
            student_id: studentId,
            score: score,
            graded_by: studentId // Sinh viên tự chấm điểm (auto-grade)
          })
          console.log('[AUTO-GRADE] Grade saved to database:', gradeResult)
        } else {
          console.log('[AUTO-GRADE] Exam not found or has no questions, skipping auto-grade')
        }
      } catch (gradeErr) {
        console.error('[ExamController.submitExam] Auto-grade error:', gradeErr.message)
        console.error('[ExamController.submitExam] Auto-grade error stack:', gradeErr.stack)
        // Không throw error để không làm fail việc nộp bài
      }
    } else {
      console.log('[AUTO-GRADE] Skipped - examId missing or submission was forced')
    }

    // Format response qua View và trả về điểm
    const response = examView.formatSubmissionResult(submission)
    response.score = score // Thêm điểm vào response
    return res.json(response)
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
