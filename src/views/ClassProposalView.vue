<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPost } from '@/lib/api'

// ── Type definitions based on the backend DB schema ──────────────────────────

interface Subject {
  id: string
  code: string
  name: string
  description?: string
  credits?: number
  status: 'pending' | 'approved' | 'rejected'
  is_locked?: boolean
}

interface ClassProposal {
  id: string
  subject_id: string
  subject?: Pick<Subject, 'code' | 'name'>
  quantity: number
  semester: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

// ── Reactive state ────────────────────────────────────────────────────────────

const subjects = ref<Subject[]>([])
const proposals = ref<ClassProposal[]>([])
const loading = ref(true)
const submitting = ref(false)
const successMsg = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

const formSubjectId = ref('')
const formQuantity = ref(1)
const formSemester = ref('HK1-2026')
const formReason = ref('')

async function loadData() {
  loading.value = true
  try {
    const [subRes, propRes] = await Promise.all([
      apiGet<{ success: boolean; data: Subject[] }>('/subjects'),
      apiGet<{ success: boolean; data: ClassProposal[] }>('/class-proposals')
    ])
    subjects.value = (subRes.data || []).filter((s) => s.status === 'approved')
    proposals.value = propRes.data || []
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Đã xảy ra lỗi.'
  }
  loading.value = false
}

onMounted(loadData)

async function handleSubmit() {
  submitting.value = true; successMsg.value = null; errorMsg.value = null
  try {
    const res = await apiPost<{ success: boolean; message: string }>('/class-proposals', {
      subjectId: formSubjectId.value,
      quantity: formQuantity.value,
      semester: formSemester.value,
      reason: formReason.value
    })
    successMsg.value = res.message
    formSubjectId.value = ''; formQuantity.value = 1; formReason.value = ''
    loadData()
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Đã xảy ra lỗi.'
  }
  submitting.value = false
}

function statusBadge(s: string) {
  if (s === 'approved') return { t: 'Đã duyệt', c: 'bg-green' }
  if (s === 'rejected') return { t: 'Từ chối', c: 'bg-red' }
  return { t: 'Chờ duyệt', c: 'bg-yellow' }
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Đề xuất SL lớp</span></div>
        <h1 class="page-title">Đề Xuất Số Lượng Lớp</h1>
        <div class="page-subtitle">Trưởng bộ môn đề xuất số lượng lớp mở cho từng môn học đã được phê duyệt.</div>
      </div>
    </div>

    <div v-if="successMsg" class="alert alert-s"><i class="pi pi-check-circle"></i> {{ successMsg }}</div>
    <div v-if="errorMsg" class="alert alert-e"><i class="pi pi-times-circle"></i> {{ errorMsg }}</div>

    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner"></i></div>

    <div v-else class="split">
      <div class="mono-card flex-1">
        <div class="card-header"><span>Tạo đề xuất mới</span></div>
        <form @submit.prevent="handleSubmit" class="card-body">
          <div class="fg">
            <label>Môn học (đã duyệt)</label>
            <select v-model="formSubjectId" class="mono-input" required>
              <option value="" disabled>-- Chọn môn --</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.code }} — {{ s.name }}</option>
            </select>
          </div>
          <div class="row-2">
            <div class="fg"><label>Số lượng lớp</label><input v-model="formQuantity" type="number" min="1" max="20" class="mono-input" required /></div>
            <div class="fg"><label>Học kỳ</label><input v-model="formSemester" type="text" class="mono-input" required /></div>
          </div>
          <div class="fg"><label>Lý do</label><textarea v-model="formReason" class="mono-input ta" placeholder="Nhu cầu đăng ký cao..."></textarea></div>
          <div class="af"><button type="submit" class="btn" :disabled="submitting"><i v-if="submitting" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-send"></i> Gửi đề xuất</button></div>
        </form>
      </div>

      <div class="side">
        <div class="mono-card">
          <div class="card-header"><span>Lịch sử đề xuất</span></div>
          <div class="card-body list">
            <div v-if="proposals.length === 0" class="empty">Chưa có đề xuất nào.</div>
            <div v-for="p in proposals" :key="p.id" class="list-item">
              <div><div class="li-code">{{ p.subject?.code || 'N/A' }} — {{ p.subject?.name || '' }}</div><div class="li-meta">SL: {{ p.quantity }} | {{ p.semester }}</div></div>
              <span class="badge" :class="statusBadge(p.status).c">{{ statusBadge(p.status).t }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; } .breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert-s { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-e { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.loading { display: flex; justify-content: center; padding: 4rem; font-size: 2rem; color: #6b7280; }
.split { display: flex; gap: 2rem; align-items: flex-start; }
.flex-1 { flex: 1; }
.side { width: 400px; flex-shrink: 0; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header { background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; }
.card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.fg { display: flex; flex-direction: column; gap: 0.4rem; }
.fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }
.mono-input { width: 100%; padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 0.95rem; outline: none; box-sizing: border-box; transition: border 0.2s; }
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.ta { min-height: 80px; resize: vertical; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.af { display: flex; justify-content: flex-end; }
.btn { padding: 0.6rem 1.5rem; background: #111827; color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; }
.btn:hover:not(:disabled) { background: #374151; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.list { gap: 0.75rem; }
.list-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
.li-code { font-weight: 600; font-size: 0.9rem; color: #111827; }
.li-meta { font-size: 0.8rem; color: #6b7280; }
.badge { font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; white-space: nowrap; }
.bg-green { background: #dcfce7; color: #166534; } .bg-red { background: #fee2e2; color: #991b1b; } .bg-yellow { background: #fef3c7; color: #92400e; }
.empty { color: #9ca3af; font-size: 0.9rem; text-align: center; padding: 1rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; } }
@media (max-width: 1024px) { .split { flex-direction: column; } .side { width: 100%; } }
</style>
