<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPost } from '@/lib/api'

interface ClassItem {
  id: string; code?: string; name: string; subjectName: string; subjectCode: string;
  instructor: string; schedule: string; enrolled: number; max: number; isRegistered: boolean;
}

const availableClasses = ref<ClassItem[]>([])
const myRegistrations = ref<string[]>([])
const loading = ref(true)
const loadingId = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

async function loadData() {
  loading.value = true
  try {
    // Lấy lớp đã đăng ký
    const regRes = await apiGet<{ success: boolean; data: any[] }>('/classes/my-registrations')
    myRegistrations.value = (regRes.data || []).map((r: any) => r.class?.id || r.class_id)

    // Lấy tất cả lớp mở
    const classRes = await apiGet<{ success: boolean; data: any[] }>('/classes')
    const classes = classRes.data || []
    availableClasses.value = (Array.isArray(classes) ? classes : []).map((c: any) => ({
      id: c.id,
      name: c.name || '',
      subjectName: c.subject?.name || 'N/A',
      subjectCode: c.subject?.code || '',
      instructor: c.instructor?.fullName || c.instructor?.full_name || 'Chưa phân công',
      schedule: c.schedule || 'Chưa xếp lịch',
      enrolled: (c.maxSlots || c.max_slots || 0) - (c.remainingSlots || c.remaining_slots || 0),
      max: c.maxSlots || c.max_slots || 0,
      isRegistered: myRegistrations.value.includes(c.id)
    }))
  } catch (err: any) {
    errorMessage.value = err.message
  }
  loading.value = false
}

onMounted(loadData)

function getCapacityPercent(enrolled: number, max: number) { return max > 0 ? (enrolled / max) * 100 : 0 }
function getProgressBarClass(enrolled: number, max: number) {
  const p = getCapacityPercent(enrolled, max)
  if (p >= 100) return 'bar-full'
  if (p >= 80) return 'bar-warning'
  return 'bar-safe'
}

async function handleRegister(cls: ClassItem) {
  if (cls.enrolled >= cls.max) return
  loadingId.value = cls.id
  successMessage.value = null
  errorMessage.value = null
  try {
    const res = await apiPost<{ success: boolean; message?: string; error?: string }>('/classes/register', { classId: cls.id })
    if (res.success) {
      cls.enrolled += 1
      cls.isRegistered = true
      successMessage.value = `Đăng ký thành công lớp ${cls.subjectCode} - ${cls.subjectName}!`
      setTimeout(() => { successMessage.value = null }, 3000)
    } else {
      errorMessage.value = res.error || 'Không thể đăng ký.'
    }
  } catch (err: any) {
    errorMessage.value = err.message
  }
  loadingId.value = null
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Đăng ký lớp học</span></div>
        <h1 class="page-title">Đăng ký Lớp học</h1>
        <div class="page-subtitle">Chọn lớp và đăng ký nhanh để giữ chỗ trong học kỳ này.</div>
      </div>
    </div>

    <div v-if="successMessage" class="mono-alert alert-success"><i class="pi pi-check-circle"></i><div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div></div>
    <div v-if="errorMessage" class="mono-alert alert-error"><i class="pi pi-times-circle"></i><div>{{ errorMessage }}</div></div>

    <div v-if="loading" class="loading-center"><i class="pi pi-spin pi-spinner" style="font-size:2rem;color:#6b7280"></i><div>Đang tải danh sách lớp...</div></div>

    <div v-else-if="availableClasses.length === 0" class="empty-state">
      <i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i>
      <h3>Chưa có lớp nào mở đăng ký</h3>
      <p>Vui lòng quay lại sau khi Phòng đào tạo mở lớp.</p>
    </div>

    <div v-else class="class-grid">
      <div v-for="cls in availableClasses" :key="cls.id" class="mono-card class-card" :class="{ 'card-registered': cls.isRegistered }">
        <div class="card-header">
          <span class="class-code">{{ cls.subjectCode }}</span>
          <span v-if="cls.isRegistered" class="status-badge badge-registered">Đã đăng ký</span>
          <span v-else-if="cls.enrolled >= cls.max" class="status-badge badge-full">Đã đầy</span>
          <span v-else class="status-badge badge-open">Mở đăng ký</span>
        </div>
        <div class="card-body">
          <h3 class="subject-name">{{ cls.subjectName }}</h3>
          <div class="info-row"><i class="pi pi-user"></i><span>{{ cls.instructor }}</span></div>
          <div class="info-row"><i class="pi pi-calendar"></i><span>{{ cls.schedule }}</span></div>
          <div class="capacity-section">
            <div class="capacity-labels"><span class="capacity-title">Sĩ số</span><span><strong>{{ cls.enrolled }}</strong> / {{ cls.max }}</span></div>
            <div class="progress-bg"><div class="progress-fill" :class="getProgressBarClass(cls.enrolled, cls.max)" :style="{ width: getCapacityPercent(cls.enrolled, cls.max) + '%' }"></div></div>
          </div>
        </div>
        <div class="card-footer">
          <button v-if="!cls.isRegistered" class="btn-submit w-full" :disabled="cls.enrolled >= cls.max || loadingId === cls.id" @click="handleRegister(cls)">
            <i v-if="loadingId === cls.id" class="pi pi-spin pi-spinner"></i>
            <i v-else-if="cls.enrolled >= cls.max" class="pi pi-ban"></i>
            <i v-else class="pi pi-bolt"></i>
            {{ cls.enrolled >= cls.max ? 'Hết chỗ' : 'Đăng ký ngay' }}
          </button>
          <div v-else class="registered-label"><i class="pi pi-check"></i> Đã đăng ký thành công</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { display: flex; flex-direction: column; padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-end; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }
.mono-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert-success { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-error { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.loading-center { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; color: #6b7280; }
.empty-state { text-align: center; padding: 4rem; color: #6b7280; }
.empty-state h3 { margin: 1rem 0 0.5rem; color: #111827; }
.class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: all 0.2s; }
.mono-card:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); transform: translateY(-2px); }
.card-registered { border-color: #bbf7d0; background: #f0fdf4; }
.card-header { padding: 1rem 1.25rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; border-radius: 12px 12px 0 0; }
.card-registered .card-header { background: #dcfce7; border-bottom-color: #bbf7d0; }
.class-code { font-weight: 600; color: #111827; font-family: monospace; font-size: 1.05rem; }
.status-badge { font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; }
.badge-open { background: #dbeafe; color: #1e40af; }
.badge-full { background: #fee2e2; color: #991b1b; }
.badge-registered { background: #166534; color: #fff; }
.card-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; flex-grow: 1; }
.subject-name { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 0.5rem 0; }
.info-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #4b5563; }
.info-row i { color: #9ca3af; }
.capacity-section { margin-top: 1rem; }
.capacity-labels { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.4rem; color: #111827; }
.capacity-title { color: #6b7280; font-weight: 500; }
.progress-bg { height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 9999px; transition: width 0.5s ease-out; }
.bar-safe { background: #22c55e; } .bar-warning { background: #f59e0b; } .bar-full { background: #ef4444; }
.card-footer { padding: 1.25rem; border-top: 1px solid #e5e7eb; }
.card-registered .card-footer { border-top-color: #bbf7d0; }
.w-full { width: 100%; }
.btn-submit { padding: 0.75rem; border: 1px solid #111827; background: #111827; color: #fff; border-radius: 8px; font-weight: 500; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; width: 100%; }
.btn-submit:hover:not(:disabled) { background: #374151; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.registered-label { text-align: center; color: #166534; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
