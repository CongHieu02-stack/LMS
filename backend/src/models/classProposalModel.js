// ============================================================================
// models/classProposalModel.js — Model truy vấn bảng class_proposals
// ============================================================================

import { supabaseAdmin } from '../config/supabase.js'

export async function findAll() {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .select(
      '*, subject:subjects(id, code, name, credits), proposer:profiles!proposed_by(id, full_name), reviewer:profiles!reviewed_by(id, full_name)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function findByStatus(status) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .select(
      '*, subject:subjects(id, code, name, credits), proposer:profiles!proposed_by(id, full_name)',
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function create(proposalData) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .insert(proposalData)
    .select('*, subject:subjects(id, code, name)')
    .single()
  if (error) throw error
  return data
}

export async function updateStatus(id, status, reviewerId) {
  const { data, error } = await supabaseAdmin
    .from('class_proposals')
    .update({ status, reviewed_by: reviewerId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, subject:subjects(id, code, name)')
    .single()
  if (error) throw error
  return data
}
