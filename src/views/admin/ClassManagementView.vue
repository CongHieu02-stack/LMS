<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiGet, apiPost } from '@/lib/api'

// States
const subjects = ref<any[]>([])
const managers = ref<any[]>([])
const loading = ref(true)
const submitting = ref(false)
const msg = ref<string | null>(null)
const errMsg = ref<string | null>(null)

const form = ref({
  subjectId: '',
  name: '',
  maxSlots: 50,
  schedule: '',
  room: '',
  semester: 'HK1-2026',
  managerId: '',
})

async function loadData() {
  loading.value = true
  try {
    const [subRes, profRes] = await Promise.all([
      apiGet<{ success: boolean; data: any[] }>('/subjects'),
      apiGet<{ success: boolean; data: any[] }>('/profiles'),
    ])
    subjects.value = (subRes.data || []).filter((s: any) => s.status === 'approved')
    managers.value = (profRes.data || []).filter((p: any) => p.role === 'TRUONG_BO_MON')
  } catch (err: any) {
    errMsg.value = err.message
  }
  loading.value = false
}

onMounted(loadData)

watch(
  () => form.value.subjectId,
  (newVal) => {
    if (!newVal) {
      form.value.managerId = ''
      return
    }
    const selectedSub = subjects.value.find((s: any) => s.id === newVal)
    if (selectedSub && selectedSub.department) {
      const matchingManager = managers.value.find(
        (m: any) => m.department === selectedSub.department
      )
      if (matchingManager) {
        form.value.managerId = matchingManager.id
      } else {
        form.value.managerId = ''
      }
    } else {
      form.value.managerId = ''
    }
  }
)

async function handleCreate() {
  submitting.value = true
  msg.value = null
  errMsg.value = null
  try {
    const res = await apiPost<{ success: boolean; message: string }>('/classes', form.value)
    msg.value = res.message
    form.value = {
      subjectId: '',
      name: '',
      maxSlots: 50,
      schedule: '',
      room: '',
      semester: 'HK1-2026',
      managerId: '',
    }
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
          Tạo lớp mới dựa trên học phần gốc đã được phê duyệt và chỉ định Trưởng bộ môn quản lý.
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
        <form @submit.prevent="handleCreate" class="card-body">
          <div class="fg">
            <label>Học phần gốc</label>
            <select v-model="form.subjectId" class="mono-input" required>
              <option value="" disabled>-- Chọn học phần gốc --</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">
                {{ s.code }} — {{ s.name }}
              </option>
            </select>
          </div>

          <div class="row-2">
            <div class="fg">
              <label>Tên lớp</label>
              <input v-model="form.name" class="mono-input" placeholder="VD: INT101-01" required />
            </div>
            <div class="fg">
              <label>Sĩ số tối đa</label>
              <input v-model="form.maxSlots" type="number" min="1" class="mono-input" required />
            </div>
          </div>

          <div class="row-2">
            <div class="fg">
              <label>Lịch học</label>
              <input v-model="form.schedule" class="mono-input" placeholder="T2 (T1-3)" />
            </div>
            <div class="fg">
              <label>Phòng học</label>
              <input v-model="form.room" class="mono-input" placeholder="VD: A101" />
            </div>
          </div>

          <div class="row-2">
            <div class="fg">
              <label>Học kỳ</label>
              <input v-model="form.semester" class="mono-input" placeholder="VD: HK1-2026" />
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
.mono-wrapper {
  padding: 1.5rem 2rem;
  animation: fadeIn 0.3s ease-out;
}
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Alert */
.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}
.alert-s {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}
.alert-e {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* Centered Form Layout */
.form-container {
  max-width: 680px;
  margin: 0 auto;
}
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.card-header {
  background: #f9fafb;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  color: #111827;
}
.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.fg {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.fg label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}
.mono-input {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
}
.mono-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
.af {
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding: 0.6rem 1.5rem;
  background: #111827;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.btn:hover:not(:disabled) {
  background: #374151;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
  font-size: 2rem;
  color: #6b7280;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
