<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ClassItem {
  id: string;
  code: string;
  subjectName: string;
  instructor: string;
  schedule: string;
  enrolled: number;
  max: number;
  isRegistered: boolean;
}

// Mock Data
const availableClasses = ref<ClassItem[]>([
  { id: '1', code: 'INT101-01', subjectName: 'Trí tuệ nhân tạo', instructor: 'TS. Nguyễn Văn A', schedule: 'T2 (T1-3)', enrolled: 48, max: 50, isRegistered: false },
  { id: '2', code: 'INT101-02', subjectName: 'Trí tuệ nhân tạo', instructor: 'ThS. Trần Thị B', schedule: 'T4 (T7-9)', enrolled: 50, max: 50, isRegistered: false },
  { id: '3', code: 'WEB202-01', subjectName: 'Lập trình Web', instructor: 'ThS. Lê C', schedule: 'T6 (T4-6)', enrolled: 12, max: 40, isRegistered: false },
])

const loadingId = ref<string | null>(null)
const successMessage = ref<string | null>(null)

function getCapacityPercent(enrolled: number, max: number) {
  return (enrolled / max) * 100
}

function getProgressBarClass(enrolled: number, max: number) {
  const percent = getCapacityPercent(enrolled, max)
  if (percent >= 100) return 'bar-full'
  if (percent >= 80) return 'bar-warning'
  return 'bar-safe'
}

async function handleRegister(cls: ClassItem) {
  if (cls.enrolled >= cls.max) return

  loadingId.value = cls.id
  successMessage.value = null

  // Giả lập call API 800ms
  setTimeout(() => {
    loadingId.value = null
    cls.enrolled += 1
    cls.isRegistered = true
    successMessage.value = `Đăng ký thành công lớp ${cls.code} - ${cls.subjectName}!`
    
    // Tự động tắt thông báo sau 3s
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  }, 800)
}
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          Học vụ / <span>Đăng ký lớp học</span>
        </div>
        <h1 class="page-title">Đăng ký Lớp học</h1>
        <div class="page-subtitle">Chọn lớp và đăng ký nhanh để giữ chỗ trong học kỳ này.</div>
      </div>
      <div class="header-stats">
        <div class="stat-box">
          <span class="stat-label">Học kỳ</span>
          <span class="stat-value">HK1 - 2026</span>
        </div>
      </div>
    </div>

    <!-- Alert -->
    <div v-if="successMessage" class="mono-alert alert-success">
      <i class="pi pi-check-circle"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Class List -->
    <div class="class-grid">
      <div v-for="cls in availableClasses" :key="cls.id" class="mono-card class-card" :class="{ 'card-registered': cls.isRegistered }">
        <div class="card-header">
          <span class="class-code">{{ cls.code }}</span>
          <span v-if="cls.isRegistered" class="status-badge badge-registered">Đã đăng ký</span>
          <span v-else-if="cls.enrolled >= cls.max" class="status-badge badge-full">Đã đầy</span>
          <span v-else class="status-badge badge-open">Mở đăng ký</span>
        </div>
        
        <div class="card-body">
          <h3 class="subject-name">{{ cls.subjectName }}</h3>
          
          <div class="info-row">
            <i class="pi pi-user text-gray-400"></i>
            <span>{{ cls.instructor }}</span>
          </div>
          <div class="info-row">
            <i class="pi pi-calendar text-gray-400"></i>
            <span>{{ cls.schedule }}</span>
          </div>

          <div class="capacity-section">
            <div class="capacity-labels">
              <span class="capacity-title">Sĩ số</span>
              <span class="capacity-numbers"><strong>{{ cls.enrolled }}</strong> / {{ cls.max }}</span>
            </div>
            <div class="progress-bg">
              <div class="progress-fill" :class="getProgressBarClass(cls.enrolled, cls.max)" :style="{ width: getCapacityPercent(cls.enrolled, cls.max) + '%' }"></div>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button 
            v-if="!cls.isRegistered"
            class="btn-submit w-full"
            :disabled="cls.enrolled >= cls.max || loadingId === cls.id"
            @click="handleRegister(cls)"
          >
            <i v-if="loadingId === cls.id" class="pi pi-spin pi-spinner"></i>
            <i v-else-if="cls.enrolled >= cls.max" class="pi pi-ban"></i>
            <i v-else class="pi pi-bolt"></i>
            {{ cls.enrolled >= cls.max ? 'Hết chỗ' : 'Đăng ký ngay' }}
          </button>
          
          <button v-else class="btn-cancel w-full">
            <i class="pi pi-times"></i> Hủy đăng ký
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;
  animation: fadeIn 0.3s ease-out;
}

/* Header */
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.breadcrumb { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.header-stats { display: flex; gap: 1rem; }
.stat-box {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 0.5rem 1rem; display: flex; flex-direction: column; align-items: flex-end;
}
.stat-label { font-size: 0.7rem; color: #6b7280; font-weight: 600; text-transform: uppercase; }
.stat-value { font-size: 1.1rem; color: #111827; font-weight: 600; }

/* Alerts */
.mono-alert {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem;
}
.alert-success { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }

/* Grid */
.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

/* Card */
.mono-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
  display: flex; flex-direction: column; transition: all 0.2s;
}
.mono-card:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04); transform: translateY(-2px); }
.card-registered { border-color: #bbf7d0; background: #f0fdf4; }

.card-header {
  padding: 1rem 1.25rem; border-bottom: 1px solid #e5e7eb;
  display: flex; justify-content: space-between; align-items: center;
  background: #f9fafb; border-top-left-radius: 12px; border-top-right-radius: 12px;
}
.card-registered .card-header { background: #dcfce7; border-bottom-color: #bbf7d0; }

.class-code { font-weight: 600; color: #111827; font-family: monospace; font-size: 1.05rem; }
.status-badge { font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 9999px; }
.badge-open { background: #dbeafe; color: #1e40af; }
.badge-full { background: #fee2e2; color: #991b1b; }
.badge-registered { background: #166534; color: #fff; }

.card-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; flex-grow: 1; }
.subject-name { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 0.5rem 0; }
.info-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #4b5563; }

/* Progress Bar */
.capacity-section { margin-top: 1rem; }
.capacity-labels { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.4rem; }
.capacity-title { color: #6b7280; font-weight: 500; }
.capacity-numbers { color: #111827; }
.progress-bg { height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 9999px; transition: width 0.5s ease-out; }
.bar-safe { background: #22c55e; }
.bar-warning { background: #f59e0b; }
.bar-full { background: #ef4444; }

/* Footer & Buttons */
.card-footer { padding: 1.25rem; border-top: 1px solid #e5e7eb; }
.card-registered .card-footer { border-top-color: #bbf7d0; }
.w-full { width: 100%; }

.btn-submit {
  padding: 0.75rem; border: 1px solid #111827; background: #111827; color: #fff;
  border-radius: 8px; font-weight: 500; font-size: 0.9rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;
}
.btn-submit:hover:not(:disabled) { background: #374151; border-color: #374151; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  padding: 0.75rem; border: 1px solid #ef4444; background: #fff; color: #ef4444;
  border-radius: 8px; font-weight: 500; font-size: 0.9rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;
}
.btn-cancel:hover { background: #fef2f2; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
