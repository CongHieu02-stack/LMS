// ============================================================================
// cleanup_test_data.js — Xóa toàn bộ dữ liệu TEST khỏi hệ thống LMS
// Sử dụng: node cleanup_test_data.js [--dry-run] [--confirm]
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run') || !args.includes('--confirm')

// ─── ĐIỀU KIỆN LỌC DỮ LIỆU TEST ───
// Xóa subjects có code chứa "TEST" (case-insensitive) hoặc name chứa "test"
// Và tất cả classes liên quan

async function getTestSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, code, name, status, created_at')
    .or('code.ilike.%TEST%,name.ilike.%test%')
    .order('code')

  if (error) throw new Error(`Lỗi lấy subjects: ${error.message}`)
  return data || []
}

async function getTestClasses(subjectIds) {
  if (subjectIds.length === 0) return []

  const { data, error } = await supabase
    .from('classes')
    .select('id, code, name, semester, status, subject_id, created_at')
    .in('subject_id', subjectIds)
    .order('code')

  if (error) throw new Error(`Lỗi lấy classes theo subject: ${error.message}`)
  return data || []
}

async function getOrphanTestClasses() {
  // Classes có code chứa TEST nhưng subject không phải TEST (nếu có)
  const { data, error } = await supabase
    .from('classes')
    .select('id, code, name, semester, status, subject_id, created_at')
    .or('code.ilike.%TEST%,name.ilike.%test%')
    .order('code')

  if (error) throw new Error(`Lỗi lấy orphan test classes: ${error.message}`)
  return data || []
}

async function getTestClassProposals(subjectIds) {
  if (subjectIds.length === 0) return []

  const { data, error } = await supabase
    .from('class_proposals')
    .select('id, subject_id, quantity, status, semester, created_at')
    .in('subject_id', subjectIds)
    .order('created_at', { ascending: false })

  if (error) {
    // Bảng có thể không tồn tại trong một số môi trường
    console.warn(`⚠️  Không thể truy vấn class_proposals: ${error.message}`)
    return []
  }
  return data || []
}

async function deleteClasses(classIds) {
  if (classIds.length === 0) return 0

  const { error, count } = await supabase
    .from('classes')
    .delete({ count: 'exact' })
    .in('id', classIds)

  if (error) throw new Error(`Lỗi xóa classes: ${error.message}`)
  return count || classIds.length
}

async function deleteClassProposals(subjectIds) {
  if (subjectIds.length === 0) return 0

  const { error, count } = await supabase
    .from('class_proposals')
    .delete({ count: 'exact' })
    .in('subject_id', subjectIds)

  if (error) {
    console.warn(`⚠️  Không thể xóa class_proposals: ${error.message}`)
    return 0
  }
  return count || 0
}

async function deleteSubjects(subjectIds) {
  if (subjectIds.length === 0) return 0

  const { error, count } = await supabase
    .from('subjects')
    .delete({ count: 'exact' })
    .in('id', subjectIds)

  if (error) throw new Error(`Lỗi xóa subjects: ${error.message}`)
  return count || subjectIds.length
}

// ─── MAIN ───
async function main() {
  console.log('=' .repeat(60))
  console.log('🔍  CÔNG CỤ DỌN DẸP DỮ LIỆU TEST — LMS System')
  console.log('=' .repeat(60))
  console.log(isDryRun ? '📋  Chế độ: DRY-RUN (chỉ xem, không xóa)' : '🗑️   Chế độ: THỰC THI (sẽ xóa vĩnh viễn!)')
  console.log()

  // ── BƯỚC 1: Tìm tất cả subjects TEST ──
  console.log('📚  Đang tìm môn học TEST...')
  const testSubjects = await getTestSubjects()

  if (testSubjects.length === 0) {
    console.log('✅  Không tìm thấy môn học TEST nào!')
  } else {
    console.log(`\n📚  Tìm thấy ${testSubjects.length} MÔN HỌC TEST:`)
    console.log('─'.repeat(60))
    testSubjects.forEach((s, i) => {
      console.log(`  ${i+1}. [${s.code}] ${s.name} (${s.status}) — ${new Date(s.created_at).toLocaleDateString('vi-VN')}`)
    })
  }

  const subjectIds = testSubjects.map(s => s.id)

  // ── BƯỚC 2: Tìm classes thuộc subjects TEST ──
  console.log('\n🏫  Đang tìm lớp học thuộc môn TEST...')
  const subjectClasses = await getTestClasses(subjectIds)

  // ── BƯỚC 3: Tìm classes có code TEST ──
  const orphanClasses = await getOrphanTestClasses()
  
  // Gộp không trùng lặp
  const allClassMap = new Map()
  ;[...subjectClasses, ...orphanClasses].forEach(c => allClassMap.set(c.id, c))
  const allTestClasses = Array.from(allClassMap.values())

  if (allTestClasses.length === 0) {
    console.log('✅  Không tìm thấy lớp học TEST nào!')
  } else {
    console.log(`\n🏫  Tìm thấy ${allTestClasses.length} LỚP HỌC TEST:`)
    console.log('─'.repeat(60))
    allTestClasses.forEach((c, i) => {
      console.log(`  ${i+1}. [${c.code || c.name}] ${c.name} (${c.status}) — HK: ${c.semester}`)
    })
  }

  // ── BƯỚC 4: Tìm class_proposals TEST ──
  console.log('\n📋  Đang tìm đề xuất lớp học TEST...')
  const testProposals = await getTestClassProposals(subjectIds)

  if (testProposals.length > 0) {
    console.log(`\n📋  Tìm thấy ${testProposals.length} ĐỀ XUẤT LỚP HỌC TEST`)
  } else {
    console.log('✅  Không tìm thấy đề xuất lớp học TEST nào!')
  }

  // ── TỔNG KẾT PREVIEW ──
  console.log('\n' + '='.repeat(60))
  console.log('📊  TÓM TẮT SẼ BỊ XÓA:')
  console.log(`    • Môn học (subjects):        ${testSubjects.length} bản ghi`)
  console.log(`    • Lớp học (classes):         ${allTestClasses.length} bản ghi`)
  console.log(`    • Đề xuất lớp (proposals):   ${testProposals.length} bản ghi`)
  console.log('    * Lưu ý: lessons, exams, grades, enrollments sẽ tự xóa CASCADE')
  console.log('='.repeat(60))

  if (isDryRun) {
    console.log('\n⚠️   DRY-RUN: Không có gì bị xóa.')
    console.log('    Để thực thi, chạy: node cleanup_test_data.js --confirm')
    return
  }

  // ── THỰC THI XÓA ──
  console.log('\n🗑️   Bắt đầu xóa dữ liệu...')

  const classIds = allTestClasses.map(c => c.id)

  // Xóa lớp học trước (cascade sẽ xóa lessons, exams, grades, enrollments)
  if (classIds.length > 0) {
    const deletedClasses = await deleteClasses(classIds)
    console.log(`  ✅  Đã xóa ${deletedClasses} lớp học (và cascade: lessons, exams, grades, enrollments)`)
  }

  // Xóa class_proposals
  if (subjectIds.length > 0) {
    const deletedProposals = await deleteClassProposals(subjectIds)
    console.log(`  ✅  Đã xóa ${deletedProposals} đề xuất lớp học`)
  }

  // Xóa subjects
  if (subjectIds.length > 0) {
    const deletedSubjects = await deleteSubjects(subjectIds)
    console.log(`  ✅  Đã xóa ${deletedSubjects} môn học`)
  }

  console.log('\n🎉  Hoàn thành! Tất cả dữ liệu TEST đã được xóa sạch.')
}

main().catch(err => {
  console.error('\n❌  Lỗi không mong muốn:', err.message)
  process.exit(1)
})
