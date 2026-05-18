<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPut } from '@/lib/api'

// State
const loading = ref(false)
const submitLoading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Form Fields
const schoolName = ref('')
const currentSemester = ref('')
const schoolStatus = ref('active')

// Fetch toàn bộ configs
async function fetchConfigs() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<any>('/configs')
    if (res.success && res.data) {
      res.data.forEach((item: any) => {
        if (item.key === 'school_name') schoolName.value = item.value
        if (item.key === 'current_semester') currentSemester.value = item.value
        if (item.key === 'school_status') schoolStatus.value = item.value
      })
    }
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Không thể tải cấu hình trường học.'
  } finally {
    loading.value = false
  }
}

// Lưu tất cả cấu hình
async function handleSaveConfigs() {
  submitLoading.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    // Gọi tuần tự cập nhật 3 key cấu hình
    await apiPut('/configs/school_name', { value: schoolName.value })
    await apiPut('/configs/current_semester', { value: currentSemester.value })
    await apiPut('/configs/school_status', { value: schoolStatus.value })

    successMessage.value = 'Đã lưu cấu hình trường học thành công.'
    await fetchConfigs()
  } catch (err) {
    errorMessage.value = (err as Error).message || 'Lỗi khi cập nhật cấu hình.'
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  fetchConfigs()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div class="breadcrumb">
        Quản trị / <span>Cấu hình Trường học</span>
      </div>
      <h1 class="page-title">Cấu hình Trường Học</h1>
      <div class="page-subtitle">Thiết lập các thông số vận hành chung của hệ thống LMS.</div>
    </div>

    <!-- Alert thông báo -->
    <div v-if="errorMessage" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>
    <div v-if="successMessage" class="mono-alert alert-success">
      <i class="pi pi-check"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Form cấu hình -->
    <div class="mono-card max-w-2xl">
      <div class="card-header">
        <span>Thông tin hệ thống</span>
        <i class="pi pi-sliders-h"></i>
      </div>

      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner spinner"></i>
        <div>Đang tải cấu hình...</div>
      </div>

      <form v-else @submit.prevent="handleSaveConfigs">
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Tên trường học</label>
            <input 
              v-model="schoolName" 
              type="text" 
              class="mono-input" 
              placeholder="Nhập tên trường học" 
              required 
            />
            <span class="form-help">Tên này sẽ hiển thị trên tiêu đề hệ thống và sidebar.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Học kỳ đào tạo hiện tại</label>
            <input 
              v-model="currentSemester" 
              type="text" 
              class="mono-input" 
              placeholder="Ví dụ: Học kỳ 1 / 2026-2027" 
              required 
            />
            <span class="form-help">Học kỳ mặc định cho việc đăng ký lớp và nhập điểm.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Trạng thái hệ thống</label>
            <div class="select-wrapper">
              <select v-model="schoolStatus" class="mono-input">
                <option value="active">Hoạt động bình thường (Active)</option>
                <option value="maintenance">Bảo trì hệ thống (Maintenance)</option>
              </select>
            </div>
            <span class="form-help">Khi đặt bảo trì, sinh viên sẽ không thể đăng ký lớp hoặc tham gia thi.</span>
          </div>
        </div>

        <div class="action-footer">
          <button type="button" class="btn-reset" @click="fetchConfigs" :disabled="submitLoading">
            Khôi phục
          </button>
          <button type="submit" class="btn-save" :disabled="submitLoading">
            <i v-if="submitLoading" class="pi pi-spin pi-spinner"></i>
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper {
  display: flex;
  flex-direction: column;
  padding: 1rem 2rem;
  box-sizing: border-box;
  animation: fadeIn 0.3s ease-out;
}

/* Header */
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}
.breadcrumb {
  font-size: 0.75rem;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 600;
}
.page-title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: normal;
  /* text-transform: removed */
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Alerts */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  border-radius: 0;
}
.mono-alert i {
  font-size: 1.25rem;
}
.alert-error {
  background-color: #fef2f2;
  border: 2px solid #ef4444;
  color: #b91c1c;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.alert-success {
  background-color: #f0fdf4;
  border: 2px solid #22c55e;
  color: #15803d;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}

/* Card */
.max-w-2xl {
  max-width: 768px;
}
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
}
.card-header {
  background-color: #f9fafb; color: #111827; border-top-left-radius: 8px; border-top-right-radius: 8px;
  padding: 1rem 1.5rem;
  font-weight: 600;
  /* text-transform: removed */
  font-size: 0.875rem;
  letter-spacing: normal;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header i {
  color: #9ca3af;
}
.card-body {
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Forms */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  /* text-transform: removed */
  letter-spacing: normal;
}
.mono-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #111827;
  outline: none;
  background-color: #fff;
  transition: all 0.2s;
  box-sizing: border-box;
}
.mono-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.form-help {
  font-size: 0.75rem;
  color: #6b7280;
}
.select-wrapper {
  position: relative;
}
.select-wrapper::after {
  content: "▼";
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.75rem;
  color: #111827;
}
select.mono-input {
  appearance: none;
  padding-right: 2.5rem;
}

/* Footer & Buttons */
.action-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #faf5ff; /* purple-50 */
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
.btn-reset {
  font-size: 0.875rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #111827;
  border: 1px solid #e5e7eb; border-radius: 8px;
  background-color: #fff;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover:not(:disabled) {
  background-color: #f3f4f6;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.btn-save {
  font-size: 0.875rem;
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  color: #fff;
  border: 1px solid #9333ea; border-radius: 8px;
  background-color: #7c3aed;
  padding: 0.75rem 2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-save:hover:not(:disabled) {
  background-color: #7e22ce;
  border-color: #7e22ce;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
}
.btn-save:disabled, .btn-reset:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #9333ea;
}
.loading-state .spinner {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}
.loading-state div {
  font-weight: 600;
  /* text-transform: removed */
  letter-spacing: normal;
  font-size: 0.75rem;
  color: #111827;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
