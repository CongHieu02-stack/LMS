<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPost } from '@/lib/api'

const subjects = ref<any[]>([])
const managers = ref<any[]>([])
const classes = ref<any[]>([])
const loading = ref(true)
const submitting = ref(false)
const msg = ref<string | null>(null)
const errMsg = ref<string | null>(null)

const form = ref({ subjectId: '', name: '', maxSlots: 50, schedule: '', room: '', semester: 'HK1-2026', managerId: '' })

async function loadData() {
  loading.value = true
  try {
    const [subRes, classRes, profRes] = await Promise.all([
      apiGet<{ success: boolean; data: any[] }>('/subjects'),
      apiGet<any>('/classes'),
      apiGet<{ success: boolean; data: any[] }>('/profiles')
    ])
    subjects.value = (subRes.data || []).filter((s: any) => s.status === 'approved')
    const classData = classRes.data || classRes
    classes.value = Array.isArray(classData) ? classData : []
    managers.value = (profRes.data || []).filter((p: any) => p.role === 'TRUONG_BO_MON')
  } catch (err: any) { errMsg.value = err.message }
  loading.value = false
}

onMounted(loadData)

async function handleCreate() {
  submitting.value = true; msg.value = null; errMsg.value = null
  try {
    const res = await apiPost<{ success: boolean; message: string }>('/classes', form.value)
    msg.value = res.message
    form.value = { subjectId: '', name: '', maxSlots: 50, schedule: '', room: '', semester: 'HK1-2026', managerId: '' }
    loadData()
  } catch (err: any) { errMsg.value = err.message }
  submitting.value = false
}
</script>

<template>
  <div class="mono-wrapper">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản lý Lớp học / <span>Tạo lớp & Gán quản lý</span></div>
        <h1 class="page-title">Tạo Lớp Học & Gán Quản Lý</h1>
        <div class="page-subtitle">Phòng đào tạo tạo lớp cho môn đã duyệt và gán Trưởng bộ môn quản lý.</div>
      </div>
    </div>

    <div v-if="msg" class="alert alert-s"><i class="pi pi-check-circle"></i> {{ msg }}</div>
    <div v-if="errMsg" class="alert alert-e"><i class="pi pi-times-circle"></i> {{ errMsg }}</div>
    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner"></i></div>

    <div v-else class="split">
      <div class="mono-card flex-1">
        <div class="card-header"><span>Tạo lớp mới</span></div>
        <form @submit.prevent="handleCreate" class="card-body">
          <div class="fg"><label>Môn học</label>
            <select v-model="form.subjectId" class="mono-input" required><option value="" disabled>-- Chọn --</option><option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.code }} — {{ s.name }}</option></select>
          </div>
          <div class="row-2">
            <div class="fg"><label>Tên lớp</label><input v-model="form.name" class="mono-input" placeholder="VD: INT101-01" required /></div>
            <div class="fg"><label>Sĩ số tối đa</label><input v-model="form.maxSlots" type="number" min="1" class="mono-input" required /></div>
          </div>
          <div class="row-2">
            <div class="fg"><label>Lịch học</label><input v-model="form.schedule" class="mono-input" placeholder="T2 (T1-3)" /></div>
            <div class="fg"><label>Phòng</label><input v-model="form.room" class="mono-input" placeholder="A101" /></div>
          </div>
          <div class="row-2">
            <div class="fg"><label>Học kỳ</label><input v-model="form.semester" class="mono-input" /></div>
            <div class="fg"><label>TBM quản lý</label>
              <select v-model="form.managerId" class="mono-input"><option value="">-- Không chọn --</option><option v-for="m in managers" :key="m.id" :value="m.id">{{ m.fullName }}</option></select>
            </div>
          </div>
          <div class="af"><button type="submit" class="btn" :disabled="submitting"><i v-if="submitting" class="pi pi-spin pi-spinner"></i><i v-else class="pi pi-plus"></i> Tạo lớp</button></div>
        </form>
      </div>

      <div class="side">
        <div class="mono-card">
          <div class="card-header"><span>Lớp đã tạo ({{ classes.length }})</span></div>
          <div class="card-body list">
            <div v-if="classes.length === 0" class="empty">Chưa có lớp nào.</div>
            <div v-for="c in classes" :key="c.id" class="list-item">
              <div><div class="li-title">{{ c.name || c.subject?.code }}</div><div class="li-meta">{{ c.subject?.name || '' }} | {{ c.maxSlots || c.max_slots }} slots</div></div>
              <span class="badge" :class="c.instructor_id ? 'bg-green' : 'bg-yellow'">{{ c.instructor_id ? 'Đã gán GV' : 'Chưa gán' }}</span>
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
.flex-1 { flex: 1; } .side { width: 400px; flex-shrink: 0; }
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.card-header { background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; }
.card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.fg { display: flex; flex-direction: column; gap: 0.4rem; } .fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }
.mono-input { width: 100%; padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 0.95rem; outline: none; box-sizing: border-box; }
.mono-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.af { display: flex; justify-content: flex-end; }
.btn { padding: 0.6rem 1.5rem; background: #111827; color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; } .btn:hover:not(:disabled) { background: #374151; } .btn:disabled { opacity: 0.6; cursor: not-allowed; }
.list { gap: 0.75rem; } .list-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
.li-title { font-weight: 600; font-size: 0.9rem; color: #111827; } .li-meta { font-size: 0.8rem; color: #6b7280; }
.badge { font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; } .bg-green { background: #dcfce7; color: #166534; } .bg-yellow { background: #fef3c7; color: #92400e; }
.empty { color: #9ca3af; font-size: 0.9rem; text-align: center; padding: 1rem; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 1024px) { .split { flex-direction: column; } .side { width: 100%; } }
</style>
