<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiGet, apiPost } from '@/lib/api'

// States
const subjects = ref<any[]>([])
const managers = ref<any[]>([])
const rooms = ref<any[]>([])
const loading = ref(true)
const submitting = ref(false)
const msg = ref<string | null>(null)
const errMsg = ref<string | null>(null)

const form = ref({
  subjectId: '',
  name: '',
  maxSlots: 50,
  room: 'auto',
  semester: 'HK1-2026',
  managerId: '',
  startDate: '',
  endDate: '',
})

interface SessionItem {
  day: string
  startTime: string
  endTime: string
}

const sessions = ref<SessionItem[]>([
  { day: 'T2', startTime: '07:30', endTime: '10:00' }
])

const minStartDateStr = ref('')

const dayLabels: Record<string, string> = {
  'T2': 'Thứ 2', 'T3': 'Thứ 3', 'T4': 'Thứ 4',
  'T5': 'Thứ 5', 'T6': 'Thứ 6', 'T7': 'Thứ 7', 'CN': 'Chủ nhật'
}

function addSession() {
  sessions.value.push({ day: 'T2', startTime: '07:30', endTime: '10:00' })
}
function removeSession(index: number) {
  sessions.value.splice(index, 1)
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

async function loadData() {
  loading.value = true
  try {
    const [subRes, profRes, roomRes] = await Promise.all([
      apiGet<{ success: boolean; data: any[] }>('/subjects'),
      apiGet<{ success: boolean; data: any[] }>('/profiles'),
      apiGet<{ success: boolean; data: any[] }>('/classes/rooms'),
    ])
    subjects.value = (subRes.data || []).filter((s: any) => s.status === 'approved' && !s.is_locked)
    managers.value = (profRes.data || []).filter((p: any) => p.role === 'TRUONG_BO_MON' && !p.isLocked)
    rooms.value = roomRes.data || []
  } catch (err: any) {
    errMsg.value = err.message
  }
  loading.value = false
}

onMounted(() => {
  loadData()
  const today = new Date()
  today.setDate(today.getDate() + 1)
  minStartDateStr.value = today.toISOString().split('T')[0]
})

watch(
  () => form.value.subjectId,
  (newVal) => {
    if (!newVal) { form.value.managerId = ''; return }
    const selectedSub = subjects.value.find((s: any) => s.id === newVal)
    if (selectedSub?.department) {
      const match = managers.value.find((m: any) => m.department === selectedSub.department)
      form.value.managerId = match ? match.id : ''
    } else {
      form.value.managerId = ''
    }
  }
)

async function handleCreate() {
  msg.value = null
  errMsg.value = null

  if (!form.value.subjectId) { errMsg.value = 'Vui lòng chọn học phần gốc.'; return }
  if (!form.value.name.trim()) { errMsg.value = 'Vui lòng nhập tên lớp.'; return }
  if (!form.value.semester.trim()) { errMsg.value = 'Vui lòng nhập học kỳ.'; return }

  const semMatch = form.value.semester.trim().match(/^HK([1-3])-(\d{4})$/i)
  if (!semMatch) { errMsg.value = 'Học kỳ không đúng định dạng. Vui lòng nhập theo dạng HK[1-3]-[Năm] (ví dụ: HK1-2026).'; return }

  if (!form.value.startDate || !form.value.endDate) { errMsg.value = 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'; return }
  if (new Date(form.value.endDate) < new Date(form.value.startDate)) { errMsg.value = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'; return }

  if (sessions.value.length === 0) { errMsg.value = 'Vui lòng thêm ít nhất một buổi học.'; return }

  for (const s of sessions.value) {
    if (!s.startTime || !s.endTime) { errMsg.value = 'Vui lòng nhập đầy đủ giờ học cho tất cả các buổi.'; return }
    if (s.startTime >= s.endTime) { errMsg.value = `Giờ bắt đầu (${s.startTime}) phải nhỏ hơn giờ kết thúc (${s.endTime}).`; return }
  }

  // Kiểm tra trùng lịch (cách nhau ít nhất 5 phút)
  for (let i = 0; i < sessions.value.length; i++) {
    for (let j = i + 1; j < sessions.value.length; j++) {
      const s1 = sessions.value[i], s2 = sessions.value[j]
      if (s1.day === s2.day) {
        const m1s = timeToMinutes(s1.startTime), m1e = timeToMinutes(s1.endTime)
        const m2s = timeToMinutes(s2.startTime), m2e = timeToMinutes(s2.endTime)
        const [, firstEnd, secondStart] = m1s <= m2s ? [m1s, m1e, m2s, m2e] : [m2s, m2e, m1s, m1e]
        if (secondStart < firstEnd + 5) {
          errMsg.value = `Lịch học vào ${dayLabels[s1.day] || s1.day} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) phải cách nhau ít nhất 5 phút.`
          return
        }
      }
    }
  }

  const compiledSchedule = sessions.value.map(s => `${s.day}(${s.startTime}-${s.endTime})`).join(', ')

  submitting.value = true
  try {
    const res = await apiPost<{ success: boolean; message: string }>('/classes', {
      ...form.value,
      schedule: compiledSchedule,
      room: form.value.room === 'auto' ? '' : form.value.room,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    })
    msg.value = res.message
    form.value = { subjectId: '', name: '', maxSlots: 50, room: 'auto', semester: 'HK1-2026', managerId: '', startDate: '', endDate: '' }
    sessions.value = [{ day: 'T2', startTime: '07:30', endTime: '10:00' }]
  } catch (err: any) {
    errMsg.value = err.message
  }
  submitting.value = false
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Tạo lớp học mới</span></div>
        <h1 class="page-title">Khởi Tạo Lớp Học</h1>
        <div class="page-subtitle">
          Tạo lớp mới dựa trên học phần gốc đã được phê duyệt với lịch học và phòng học cụ thể.
        </div>
      </div>
    </div>

    <!-- Alert Notifications -->
    <div v-if="msg" class="alert alert-s"><i class="pi pi-check-circle"></i> {{ msg }}</div>
    <div v-if="errMsg" class="alert alert-e"><i class="pi pi-times-circle"></i> {{ errMsg }}</div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="loading">
      <i class="pi pi-spin pi-spinner"></i>
    </div>

    <!-- Creation Card Form -->
    <div v-else class="form-container">
      <div class="mono-card">
        <div class="card-header">
          <span>Thông tin lớp học mới</span>
        </div>
        <form @submit.prevent="handleCreate" class="card-body" novalidate>

          <!-- Học phần gốc -->
          <div class="fg">
            <label>Học phần gốc <span class="required">*</span></label>
            <select v-model="form.subjectId" class="mono-input" required>
              <option value="" disabled>-- Chọn học phần gốc --</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">
                {{ s.code }} — {{ s.name }}
              </option>
            </select>
          </div>

          <!-- Tên lớp + Sĩ số -->
          <div class="row-2">
            <div class="fg">
              <label>Tên lớp <span class="required">*</span></label>
              <input v-model="form.name" class="mono-input" placeholder="VD: INT101-01" required />
            </div>
            <div class="fg">
              <label>Sĩ số tối đa <span class="required">*</span></label>
              <input v-model="form.maxSlots" type="number" min="1" max="200" class="mono-input" required />
            </div>
          </div>

          <!-- Học kỳ + TBM -->
          <div class="row-2">
            <div class="fg">
              <label>Học kỳ <span class="required">*</span></label>
              <input v-model="form.semester" class="mono-input" placeholder="VD: HK1-2026" required />
            </div>
            <div class="fg">
              <label>Trưởng bộ môn quản lý</label>
              <select v-model="form.managerId" class="mono-input">
                <option value="">-- Không chỉ định --</option>
                <option v-for="m in managers" :key="m.id" :value="m.id">
                  {{ m.fullName }}
                </option>
              </select>
            </div>
          </div>

          <!-- Ngày bắt đầu + Ngày kết thúc -->
          <div class="row-2">
            <div class="fg">
              <label>Ngày bắt đầu <span class="required">*</span></label>
              <input v-model="form.startDate" type="date" :min="minStartDateStr" class="mono-input" required />
            </div>
            <div class="fg">
              <label>Ngày kết thúc <span class="required">*</span></label>
              <input v-model="form.endDate" type="date" class="mono-input" required />
            </div>
          </div>

          <!-- Thời khóa biểu -->
          <div class="fg">
            <div class="schedule-label-row">
              <span>Thời khóa biểu hàng tuần <span class="required">*</span></span>
              <button type="button" @click="addSession" class="btn-add-session">
                <i class="pi pi-plus"></i> Thêm buổi học
              </button>
            </div>
            <div v-for="(session, index) in sessions" :key="index" class="session-row">
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
              <span class="session-sep">đến</span>
              <input v-model="session.endTime" type="time" class="mono-input" style="flex: 2;" required />
              <button type="button" @click="removeSession(index)" class="btn-remove-session" :disabled="sessions.length <= 1">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>

          <!-- Phòng học -->
          <div class="fg">
            <label>Phòng học</label>
            <select v-model="form.room" class="mono-input">
              <option value="auto">-- Chưa chỉ định phòng --</option>
              <option v-for="r in rooms" :key="r.id" :value="r.name">
                Phòng {{ r.name }} (Sức chứa: {{ r.capacity }} chỗ)
              </option>
            </select>
          </div>

          <!-- Submit -->
          <div class="af">
            <button type="submit" class="btn" :disabled="submitting">
              <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
              <i v-else class="pi pi-plus"></i> Tạo lớp học mới
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert-s { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-e { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

.form-container { max-width: 680px; margin: 0 auto; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header { background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; }
.card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.fg { display: flex; flex-direction: column; gap: 0.4rem; }
.fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }
.required { color: #ef4444; font-weight: bold; }

.mono-input { width: 100%; padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 0.95rem; outline: none; box-sizing: border-box; transition: border 0.2s; }
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }

.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.af { display: flex; justify-content: flex-end; }

.schedule-label-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; color: #374151; }
.btn-add-session { background: transparent; border: none; color: #7c3aed; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 4px; }
.btn-add-session:hover { background: #faf5ff; }

.session-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; animation: fadeIn 0.2s ease-out; }
.session-sep { font-size: 0.85rem; color: #6b7280; flex-shrink: 0; }
.btn-remove-session { background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; border-radius: 8px; padding: 0.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
.btn-remove-session:hover:not(:disabled) { background: #fee2e2; color: #b91c1c; }
.btn-remove-session:disabled { opacity: 0.4; cursor: not-allowed; }

.btn { padding: 0.6rem 1.5rem; background: #111827; color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; }
.btn:hover:not(:disabled) { background: #374151; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.loading { display: flex; justify-content: center; padding: 4rem; font-size: 2rem; color: #6b7280; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
