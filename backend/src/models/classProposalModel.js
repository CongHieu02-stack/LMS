// ============================================================================
// models/classProposalModel.js — Model truy vấn bảng class_proposals
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

export async function findAll() {
  // Dùng select đơn giản, tránh join phức tạp có thể gây lỗi
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .select(
      '*, subject:subjects(id, code, name, credits), proposer:profiles!proposed_by(id, full_name)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[classProposalModel.findAll] Supabase error:', JSON.stringify(error))
    throw new Error(error.message || 'Lỗi truy vấn danh sách đề xuất.')
  }
  return data || []
}

export async function findByStatus(status) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .select(
      '*, subject:subjects(id, code, name, credits), proposer:profiles!proposed_by(id, full_name)'
    )
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[classProposalModel.findByStatus] Supabase error:', JSON.stringify(error))
    throw new Error(error.message || 'Lỗi truy vấn đề xuất theo trạng thái.')
  }
  return data || []
}

export async function create(proposalData) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .insert(proposalData)
    .select('*, subject:subjects(id, code, name)')
    .single()

  if (error) {
    console.error('[classProposalModel.create] Supabase error:', JSON.stringify(error))
    throw new Error(error.message || 'Lỗi tạo đề xuất mới.')
  }
  return data
}

export async function updateStatus(id, status, reviewerId) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .update({ status, reviewed_by: reviewerId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, subject:subjects(id, code, name, department)')
    .single()

  if (error) {
    console.error('[classProposalModel.updateStatus] Supabase error:', JSON.stringify(error))
    throw new Error(error.message || 'Lỗi cập nhật trạng thái đề xuất.')
  }

  if (status === 'approved') {
    const qty = data.quantity || 1
    const subjectId = data.subject_id
    const semester = data.semester
    const subjectCode = data.subject?.code || 'CLASS'
    const subjectDept = data.subject?.department
    let managerId = data.proposed_by
    const maxStudents = data.max_students || 50
    const schedule = data.schedule || ''
    const startDate = data.start_date || null
    const endDate = data.end_date || null

    // Tìm Trưởng bộ môn phụ trách Khoa/Bộ môn này
    if (subjectDept) {
      const { data: tbmUser, error: tbmErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'TRUONG_BO_MON')
        .eq('department', subjectDept)
        .limit(1)
        .maybeSingle()

      if (!tbmErr && tbmUser) {
        managerId = tbmUser.id
      } else {
        console.warn(`[classProposalModel.updateStatus] Không tìm thấy Trưởng bộ môn cho khoa: ${subjectDept}. Fallback về proposer.`)
      }
    }

    // Find current number of classes for this subject and semester to compute index
    const { count, error: countError } = await supabaseAdmin
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId)
      .eq('semester', semester)
    
    const startIdx = countError ? 0 : (count || 0)

    // Insert classes
    const classesToInsert = []
    for (let i = 0; i < qty; i++) {
      const idx = startIdx + i + 1
      const padIdx = idx < 10 ? `0${idx}` : `${idx}`
      const className = `${data.subject?.name || 'Lớp học'} - Lớp ${padIdx}`

      classesToInsert.push({
        subject_id: subjectId,
        code: `${subjectCode}-${semester}-${padIdx}`,
        name: className,
        semester: semester,
        status: 'draft',
        manager_id: managerId,
        max_students: maxStudents,
        max_slots: maxStudents,
        remaining_slots: maxStudents,
        schedule: schedule,
        room: '',
        start_date: startDate,
        end_date: endDate
      })
    }

    const { error: insertError } = await supabaseAdmin
      .from('classes')
      .insert(classesToInsert)

    if (insertError) {
      console.error('[classProposalModel.updateStatus] Error inserting classes:', JSON.stringify(insertError))
      throw new Error(`Đã duyệt đề xuất nhưng không thể tạo khung lớp học: ${insertError.message}`)
    }
  }

  return data
}
