<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPost } from '@/lib/api'
import { useToast } from 'primevue/usetoast'
import pvToast from 'primevue/toast'

const toast = useToast()

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
  max_students?: number
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
const formMaxStudents = ref(50)
const formSemester = ref(`HK1-${new Date().getFullYear()}`)
const formReason = ref('')
const formStartDate = ref('')
const formEndDate = ref('')
const minStartDateStr = ref('')

interface SessionItem {
  day: string
  startTime: string
  endTime: string
}

const formSessions = ref<SessionItem[]>([
  { day: 'T2', startTime: '07:30', endTime: '10:00' }
])

function addSession() {
  formSessions.value.push({ day: 'T2', startTime: '07:30', endTime: '10:00' })
}

function removeSession(index: number) {
  formSessions.value.splice(index, 1)
}

function formatDate(d?: string) {
  if (!d) return '—'
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return d
  const dd = String(dateObj.getDate()).padStart(2, '0')
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const yyyy = dateObj.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

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

onMounted(() => {
  loadData()
  const today = new Date()
  today.setDate(today.getDate() + 14)
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  minStartDateStr.value = `${yyyy}-${mm}-${dd}`
})

async function handleSubmit() {
  submitting.value = true; successMsg.value = null; errorMsg.value = null

  if (!formSubjectId.value) {
    const msg = 'Vui lòng chọn môn học cần đề xuất.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi nhập liệu', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  if (!formQuantity.value || formQuantity.value < 1) {
    const msg = 'Số lượng lớp học phải tối thiểu là 1.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi nhập liệu', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  if (!formMaxStudents.value || formMaxStudents.value < 1) {
    const msg = 'Sĩ số/Lớp tối đa phải tối thiểu là 1.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi nhập liệu', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  if (!formSemester.value || !formSemester.value.trim()) {
    const msg = 'Vui lòng điền thông tin học kỳ.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi nhập liệu', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  const semesterRegex = /^HK([1-3])-(\d{4})$/i
  const semMatch = formSemester.value.trim().match(semesterRegex)
  if (!semMatch) {
    const msg = 'Học kỳ không đúng định dạng. Vui lòng nhập theo dạng HK[1-3]-[Năm] (ví dụ: HK1-2026).'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi định dạng', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  const semYear = parseInt(semMatch[2])
  const currentYear = new Date().getFullYear()
  if (semYear < currentYear) {
    const msg = `Năm của học kỳ đề xuất không được trước năm ${currentYear}.`
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Học kỳ không hợp lệ', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  if (!formStartDate.value || !formEndDate.value) {
    const msg = 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi nhập liệu', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  const start = new Date(formStartDate.value)
  const end = new Date(formEndDate.value)
  
  if (end < start) {
    const msg = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Khoảng thời gian không hợp lệ', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minStartDate = new Date(today)
  minStartDate.setDate(minStartDate.getDate() + 14)

  start.setHours(0, 0, 0, 0)
  if (start < minStartDate) {
    const msg = 'Ngày bắt đầu phải cách ngày hiện tại ít nhất 2 tuần (14 ngày).'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Ràng buộc thời gian', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  if (formSessions.value.length === 0) {
    const msg = 'Vui lòng thêm ít nhất một buổi học.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Thiếu lịch học', detail: msg, life: 5000 })
    submitting.value = false
    return
  }

  // Kiểm tra thời gian của các buổi học
  for (const session of formSessions.value) {
    if (!session.startTime || !session.endTime) {
      const msg = 'Vui lòng nhập đầy đủ giờ học cho tất cả các buổi.'
      errorMsg.value = msg
      toast.add({ severity: 'error', summary: 'Thời gian buổi học', detail: msg, life: 5000 })
      submitting.value = false
      return
    }
    if (session.startTime >= session.endTime) {
      const msg = `Giờ bắt đầu (${session.startTime}) phải nhỏ hơn giờ kết thúc (${session.endTime}).`
      errorMsg.value = msg
      toast.add({ severity: 'error', summary: 'Giờ học không hợp lệ', detail: msg, life: 5000 })
      submitting.value = false
      return
    }
  }

  // Đóng gói danh sách buổi học thành chuỗi lịch học chuẩn
  const compiledSchedule = formSessions.value.map((s: SessionItem) => `${s.day}(${s.startTime}-${s.endTime})`).join(', ')

  try {
    const res = await apiPost<{ success: boolean; message: string }>('/class-proposals', {
      subjectId: formSubjectId.value,
      quantity: formQuantity.value,
      maxStudents: formMaxStudents.value,
      semester: formSemester.value,
      reason: formReason.value,
      schedule: compiledSchedule,
      startDate: formStartDate.value,
      endDate: formEndDate.value
    })
    successMsg.value = res.message
    toast.add({ severity: 'success', summary: 'Thành công', detail: res.message, life: 4000 })
    formSubjectId.value = ''; formQuantity.value = 1; formMaxStudents.value = 50; formReason.value = ''
    formStartDate.value = ''; formEndDate.value = ''
    formSessions.value = [{ day: 'T2', startTime: '07:30', endTime: '10:00' }]
    loadData()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi.'
    errorMsg.value = msg
    toast.add({ severity: 'error', summary: 'Lỗi gửi đề xuất', detail: msg, life: 5000 })
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
  <pv-toast />
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Đề xuất SL lớp</span></div>
        <h1 class="page-title">Đề Xuất Số Lượng Lớp</h1>
        <div class="page-subtitle">Trưởng bộ môn đề xuất số lượng lớp mở cho từng môn học đã được phê duyệt kèm lịch học mong muốn.</div>
      </div>
    </div>

    <div v-if="successMsg" class="alert alert-s"><i class="pi pi-check-circle"></i> {{ successMsg }}</div>
    <div v-if="errorMsg" class="alert alert-e"><i class="pi pi-times-circle"></i> {{ errorMsg }}</div>

    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner"></i></div>

    <div v-else class="split">
      <div class="mono-card flex-1">
        <div class="card-header"><span>Tạo đề xuất mới</span></div>
        <form @submit.prevent="handleSubmit" class="card-body" novalidate>
          <div class="fg">
            <label>Môn học (đã duyệt)</label>
            <select v-model="formSubjectId" class="mono-input" required>
              <option value="" disabled>-- Chọn môn --</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.code }} — {{ s.name }}</option>
            </select>
          </div>
          <div class="row-3">
            <div class="fg"><label>Số lượng lớp</label><input v-model="formQuantity" type="number" min="1" max="20" class="mono-input" required /></div>
            <div class="fg"><label>Sĩ số/Lớp</label><input v-model="formMaxStudents" type="number" min="1" max="150" class="mono-input" required /></div>
            <div class="fg">
              <label>Học kỳ <span class="required">*</span></label>
              <input v-model="formSemester" type="text" class="mono-input" placeholder="Ví dụ: HK1-2026" required />
            </div>
          </div>
          <div class="row-2">
            <div class="fg">
              <label>Ngày bắt đầu <span class="required">*</span></label>
              <input v-model="formStartDate" type="date" :min="minStartDateStr" class="mono-input" required />
            </div>
            <div class="fg">
              <label>Ngày kết thúc <span class="required">*</span></label>
              <input v-model="formEndDate" type="date" class="mono-input" required />
            </div>
          </div>
          <div class="fg">
            <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span>Thời khóa biểu hàng tuần <span class="required">*</span></span>
              <button type="button" @click="addSession" class="btn-add-session"><i class="pi pi-plus"></i> Thêm buổi học</button>
            </label>
            <div v-for="(session, index) in formSessions" :key="index" class="session-row">
              <select v-model="session.day" class="mono-input" style="flex: 2;" required>
                <option value="T2">Thứ 2</option>
                <option value="T3">Thứ 3</option>
                <option value="T4">Thứ 4</option>
                <option value="T5">Thứ 5</option>
                <option value="T6">Thứ 6</option>
                <option value="T7">Thứ 7</option>
                <option value="CN">Chủ nhật</option>
              </select>
              <input v-model="session.startTime" type="time" class="mono-input" style="flex: 2;" required />
              <span class="session-separator">đến</span>
              <input v-model="session.endTime" type="time" class="mono-input" style="flex: 2;" required />
              <button type="button" @click="removeSession(index)" class="btn-remove-session" :disabled="formSessions.length <= 1">
                <i class="pi pi-trash"></i>
              </button>
            </div>
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
              <div>
                <div class="li-code">{{ p.subject?.code || 'N/A' }} — {{ p.subject?.name || '' }}</div>
                <div class="li-meta">SL: {{ p.quantity }} | Sĩ số: {{ p.max_students || 50 }} | {{ p.semester }}</div>
                <div v-if="p.schedule" class="li-meta" style="color: #7c3aed; font-weight: 500;"><i class="pi pi-calendar mr-1"></i>Lịch học: {{ p.schedule }}</div>
                <div v-if="p.start_date || p.end_date" class="li-meta" style="color: #4b5563;"><i class="pi pi-clock mr-1"></i>Thời gian: {{ formatDate(p.start_date) }} - {{ formatDate(p.end_date) }}</div>
              </div>
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
.row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.25rem; }
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
.btn-add-session {
  background: transparent;
  border: none;
  color: #7c3aed;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.btn-add-session:hover {
  background: #faf5ff;
}
.session-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  animation: fadeIn 0.2s ease-out;
}
.session-separator {
  font-size: 0.85rem;
  color: #6b7280;
  flex-shrink: 0;
}
.btn-remove-session {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #ef4444;
  border-radius: 8px;
  padding: 0.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-remove-session:hover:not(:disabled) {
  background: #fee2e2;
  color: #b91c1c;
}
.btn-remove-session:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.required {
  color: #ef4444;
  font-weight: bold;
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; } }
@media (max-width: 1024px) { .split { flex-direction: column; } .side { width: 100%; } }
</style>
