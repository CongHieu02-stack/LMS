// ============================================================================
// views/examView.js — View formatter cho Exam Submissions
// Trách nhiệm DUY NHẤT: Format dữ liệu bài nộp thi thành JSON response.
// KHÔNG chứa logic chấm điểm hay nghiệp vụ.
// ============================================================================

/**
 * Format kết quả nộp bài
 * @param {object} submission — Submission row từ DB
 * @returns {object}
 */
export function formatSubmissionResult(submission) {
  if (!submission) return null
  return {
    success: true,
    message: submission.is_forced
      ? 'Bài thi đã được nộp bắt buộc do vi phạm quy chế.'
      : 'Nộp bài thành công!',
    submission: {
      id: submission.id,
      examTitle: submission.exam_title,
      totalAnswers: Array.isArray(submission.answers) ? submission.answers.length : 0,
      isForced: submission.is_forced,
      violations: submission.violations,
      submittedAt: submission.submitted_at
    }
  }
}

/**
 * Format danh sách bài nộp
 * @param {Array} rawList
 * @returns {object}
 */
export function formatSubmissionList(rawList) {
  return {
    data: (rawList || []).map(item => ({
      id: item.id,
      examId: item.exam_id,
      examTitle: item.exam_title,
      score: item.score,
      isForced: item.is_forced,
      violations: item.violations,
      submittedAt: item.submitted_at,
      startedAt: item.started_at,
      answers: item.answers || [],
      student: item.student ? {
        id: item.student.id,
        fullName: item.student.full_name,
        email: item.student.email
      } : null
    })),
    total: rawList?.length || 0
  }
}
