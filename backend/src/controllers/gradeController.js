// ============================================================================
// controllers/gradeController.js — Xem bảng điểm
// ============================================================================

import * as gradeModel from '../models/gradeModel.js'

export async function getMyGrades(req, res) {
  try {
    const grades = await gradeModel.findByStudent(req.user.id)
    
    // Group by subject and calculate regular/midterm/final/average
    const subjectMap = new Map()
    
    for (const grade of grades) {
      if (!grade.class?.subject?.code) continue
      
      const subjectCode = grade.class.subject.code
      if (!subjectMap.has(subjectCode)) {
        subjectMap.set(subjectCode, {
          subjectCode,
          subjectName: grade.class.subject.name || 'N/A',
          credits: grade.class.subject.credits || 0,
          semester: grade.class.semester || 'N/A',
          className: grade.class.name || '',
          regularScores: [],
          midtermScore: null,
          finalScore: null,
          scores: []
        })
      }
      
      const subject = subjectMap.get(subjectCode)
      subject.scores.push(grade.score)
      
      if (grade.exam_type === 'regular') {
        subject.regularScores.push(grade.score)
      } else if (grade.exam_type === 'midterm') {
        subject.midtermScore = grade.score
      } else if (grade.exam_type === 'final') {
        subject.finalScore = grade.score
      }
    }
    
    // Calculate average for each subject: regular 20%, midterm 30%, final 60%
    // Only calculate average when all required scores exist
    const processedGrades = Array.from(subjectMap.values()).map(subject => {
      let avgScore = null
      let pass = null
      
      // Sort regular scores and take top 2
      const sortedRegularScores = [...subject.regularScores].sort((a, b) => b - a)
      const regular1 = sortedRegularScores[0] || null
      const regular2 = sortedRegularScores[1] || null
      
      // Calculate regular average (only if both exist)
      let regularAvg = null
      if (regular1 !== null && regular2 !== null) {
        regularAvg = (regular1 + regular2) / 2
      }
      
      // Calculate final average only when all components exist
      if (regularAvg !== null && subject.midtermScore !== null && subject.finalScore !== null) {
        avgScore = (regularAvg * 0.2) + (subject.midtermScore * 0.3) + (subject.finalScore * 0.6)
        avgScore = Math.round(avgScore * 10) / 10 // Round to 1 decimal place
        pass = avgScore >= 5.0
      }
      
      return {
        ...subject,
        regular1: regular1 !== null ? Math.round(regular1 * 10) / 10 : null,
        regular2: regular2 !== null ? Math.round(regular2 * 10) / 10 : null,
        averageScore: avgScore,
        pass
      }
    })
    
    return res.json({ success: true, data: processedGrades })
  } catch (err) {
    console.error('[GradeController.getMyGrades]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm.' })
  }
}

export async function getByClass(req, res) {
  try {
    const grades = await gradeModel.findByClass(req.params.classId)
    return res.json({ success: true, data: grades })
  } catch (err) {
    console.error('[GradeController.getByClass]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lấy bảng điểm lớp.' })
  }
}

export async function saveGrade(req, res) {
  try {
    const { classId, studentId, examId, score } = req.body
    if (!classId || !studentId || score === undefined) {
      return res.status(400).json({ error: 'Thiếu classId, studentId hoặc score.' })
    }
    const grade = await gradeModel.upsert({
      class_id: classId,
      student_id: studentId,
      exam_id: examId || null,
      score: parseFloat(score),
      graded_by: req.user.id
    })
    return res.json({ success: true, message: 'Cập nhật điểm thành công.', data: grade })
  } catch (err) {
    console.error('[GradeController.saveGrade]', err.message)
    return res.status(500).json({ error: 'Lỗi khi lưu điểm.' })
  }
}
