// ============================================================================
// controllers/examController.js — Controller nộp bài thi
// ============================================================================

import * as examModel from '../models/examModel.js'
import * as examView from '../views/examView.js'
import * as examManageModel from '../models/examManageModel.js'
import * as gradeModel from '../models/gradeModel.js'
import { logActivity } from '../utils/activityLogger.js'

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

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Dữ liệu bài làm không hợp lệ.'
      })
    }

    const submission = await examModel.saveSubmission({
      student_id: studentId,
      exam_title: examTitle,
      answers,
      is_forced: isForced || false,
      violations: violations || 0
    })

    if (isForced) {
      console.warn(
        `[ANTI-CHEAT] Nộp bài bắt buộc: student=${studentId}, violations=${violations}, exam="${examTitle}"`
      )
    }

    // ==========================
    // AUTO GRADE (FIXED LOGIC)
    // ==========================
    let score = 0

    console.log('[AUTO-GRADE] Starting auto-grade process', {
      examId,
      classId,
      isForced
    })

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

          exam.questions.forEach((q, index) => {
            const studentAnswer = answers?.[index]

            if (!studentAnswer) return

            const selected =
              studentAnswer.selected_option ??
              studentAnswer.answer ??
              studentAnswer

            if (Number(selected) === Number(q.answer)) {
              correct++
            }
          })

          score =
            exam.questions.length > 0
              ? parseFloat(
                  ((correct / exam.questions.length) * 10).toFixed(1)
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

          // ==========================
          // FIX: chuẩn hoá theo môn học (class)
          // ==========================
          const gradeResult = await gradeModel.upsert({
            exam_id: examId,
            class_id: classId, // 🔥 quan trọng để không tách môn
            student_id: studentId,
            score,
            graded_by: studentId
          })

          console.log(
            '[AUTO-GRADE] Grade saved to database:',
            gradeResult
          )
        } else {
          console.log('[AUTO-GRADE] Exam not found or invalid questions')
        }
      } catch (gradeErr) {
        console.error('[AUTO-GRADE ERROR]', gradeErr.message)
      }
    } else {
      console.log('[AUTO-GRADE] Skipped')
    }

    const response = examView.formatSubmissionResult(submission)
    response.score = score

    await logActivity(req, 'SUBMIT_EXAM', `Nộp bài thi: ${examTitle}. Điểm số: ${score}, Số lần vi phạm: ${violations}`)

    return res.json(response)
  } catch (err) {
    console.error('[submitExam]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi nộp bài thi.'
    })
  }
}

export async function getMySubmissions(req, res) {
  try {
    const submissions = await examModel.findByStudent(req.user.id)

    return res.json(
      examView.formatSubmissionList(submissions)
    )
  } catch (err) {
    console.error('[getMySubmissions]', err.message)

    return res.status(500).json({
      error: 'Lỗi khi lấy bài nộp.'
    })
  }
}