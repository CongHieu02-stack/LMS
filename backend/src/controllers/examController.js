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
    const {
      examTitle,
      examId,
      classId,
      answers,
      isForced,
      violations
    } = req.body

    const studentId = req.user.id

    // Validate input cơ bản
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Dữ liệu bài làm không hợp lệ.'
      })
    }

    // Lưu bài nộp
    const submission = await examModel.saveSubmission({
      student_id: studentId,
      exam_title: examTitle,
      answers,
      is_forced: isForced || false,
      violations: violations || 0
    })

    // Log nếu là nộp bắt buộc
    if (isForced) {
      console.warn(
        `[ANTI-CHEAT] Nộp bài bắt buộc: student=${studentId}, violations=${violations}, exam="${examTitle}"`
      )
    }

    // ==========================
    // AUTO GRADE
    // ==========================
    let score = 0

    console.log(
      '[AUTO-GRADE] Starting auto-grade process',
      {
        examId,
        isForced
      }
    )

    if (examId && !isForced) {
      try {
        const exam = await examManageModel.findById(examId)

        console.log(
          '[AUTO-GRADE] Exam found:',
          !!exam,
          'questions:',
          exam?.questions?.length || 0
        )

        if (exam && Array.isArray(exam.questions)) {
          let correct = 0

          exam.questions.forEach((q) => {
            const studentAnswer = answers.find(
              (a) => a.question_id === q.id
            )

            console.log('====================')
            console.log('QUESTION:', JSON.stringify(q, null, 2))
            console.log('QUESTION ID:', q.id)
            console.log('CORRECT ANSWER:', q.answer)
            console.log('CORRECT ANSWER TYPE:', typeof q.answer)
            console.log(
              'STUDENT ANSWER:',
              studentAnswer?.selected_option
            )
            console.log(
              'STUDENT ANSWER TYPE:',
              typeof studentAnswer?.selected_option
            )

            if (
              studentAnswer &&
              studentAnswer.selected_option === q.answer
            ) {
              correct++
            }
          })

          score =
            exam.questions.length > 0
              ? parseFloat(
                  (
                    (correct / exam.questions.length) *
                    10
                  ).toFixed(1)
                )
              : 0

          console.log(
            '[AUTO-GRADE] Calculated score:',
            score,
            'correct:',
            correct,
            'total:',
            exam.questions.length
          )

          const gradeResult = await gradeModel.upsert({
            exam_id: examId,
            student_id: studentId,
            score,
            graded_by: studentId
          })

          console.log(
            '[AUTO-GRADE] Grade saved to database:',
            gradeResult
          )
        } else {
          console.log(
            '[AUTO-GRADE] Exam not found or has no questions'
          )
        }
      } catch (gradeErr) {
        console.error(
          '[ExamController.submitExam] Auto-grade error:',
          gradeErr.message
        )

        console.error(
          '[ExamController.submitExam] Auto-grade stack:',
          gradeErr.stack
        )
      }
    } else {
      console.log(
        '[AUTO-GRADE] Skipped - examId missing or submission was forced'
      )
    }

    // Response
    const response = examView.formatSubmissionResult(submission)
    response.score = score

    return res.json(response)
  } catch (err) {
    console.error(
      '[ExamController.submitExam]',
      err.message
    )

    return res.status(500).json({
      error: 'Lỗi khi nộp bài thi.'
    })
  }
}

/**
 * GET /api/exam/my-submissions
 */
export async function getMySubmissions(req, res) {
  try {
    const submissions = await examModel.findByStudent(
      req.user.id
    )

    return res.json(
      examView.formatSubmissionList(submissions)
    )
  } catch (err) {
    console.error(
      '[ExamController.getMySubmissions]',
      err.message
    )

    return res.status(500).json({
      error: 'Lỗi khi lấy bài nộp.'
    })
  }
}