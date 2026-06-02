<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet, apiPut } from '@/lib/api'

interface ConfigItem {
  key: string;
  value: string;
}

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
    const res = await apiGet<{ success: boolean; data?: ConfigItem[] }>('/configs')
    if (res.success && res.data) {
      res.data.forEach((item: ConfigItem) => {
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

const statusLabel = computed(() =>
  schoolStatus.value === 'active' ? 'Hoạt động' : 'Bảo trì'
)
const statusClass = computed(() =>
  schoolStatus.value === 'active' ? 'badge-active' : 'badge-maintenance'
)

onMounted(() => {
  fetchConfigs()
})
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Quản trị / <span>Cấu hình Trường học</span></div>
        <h1 class="page-title">Cấu hình Trường Học</h1>
        <div class="page-subtitle">Thiết lập các thông số vận hành chung của hệ thống LMS.</div>
      </div>
    </div>

    <!-- Alert thông báo -->
    <div v-if="errorMessage" class="mono-alert alert-error">
      <i class="pi pi-exclamation-triangle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>
    <div v-if="successMessage" class="mono-alert alert-success">
      <i class="pi pi-check-circle"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner spinner"></i>
      <div>Đang tải cấu hình...</div>
    </div>

    <template v-else>
      <!-- Thẻ thông tin nhanh -->
      <div class="stats-row">
        <div class="mono-card stat-card">
          <div class="stat-icon-wrapper icon-purple">
            <i class="pi pi-building"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ schoolName || '—' }}</div>
            <div class="stat-label">Tên Trường học</div>
          </div>
        </div>
        <div class="mono-card stat-card">
          <div class="stat-icon-wrapper icon-blue">
            <i class="pi pi-calendar"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value semester-val">{{ currentSemester || '—' }}</div>
            <div class="stat-label">Học kỳ hiện tại</div>
          </div>
        </div>
        <div class="mono-card stat-card">
          <div class="stat-icon-wrapper" :class="schoolStatus === 'active' ? 'icon-green' : 'icon-orange'">
            <i :class="schoolStatus === 'active' ? 'pi pi-check-circle' : 'pi pi-wrench'"></i>
          </div>
          <div class="stat-content">
            <div>
              <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
            </div>
            <div class="stat-label">Trạng thái hệ thống</div>
          </div>
        </div>
      </div>

      <!-- Form chỉnh sửa -->
      <div class="mono-card config-card">
        <div class="card-header">
          <span>Thông tin hệ thống</span>
          <i class="pi pi-sliders-h"></i>
        </div>

        <form @submit.prevent="handleSaveConfigs">
          <div class="card-body">
            <!-- Tên trường -->
            <div class="form-group">
              <label class="form-label">
                <i class="pi pi-building label-icon"></i>
                Tên trường học
              </label>
              <input
                v-model="schoolName"
                type="text"
                class="mono-input"
                placeholder="Nhập tên trường học"
                required
              />
              <span class="form-help">Tên này sẽ hiển thị trên tiêu đề hệ thống và sidebar.</span>
            </div>

            <!-- Học kỳ -->
            <div class="form-group">
              <label class="form-label">
                <i class="pi pi-calendar label-icon"></i>
                Học kỳ đào tạo hiện tại
              </label>
              <input
                v-model="currentSemester"
                type="text"
                class="mono-input"
                placeholder="Ví dụ: Học kỳ 1 / 2026-2027"
                required
              />
              <span class="form-help">Học kỳ mặc định cho việc đăng ký lớp và nhập điểm.</span>
            </div>

            <!-- Trạng thái -->
            <div class="form-group">
              <label class="form-label">
                <i class="pi pi-shield label-icon"></i>
                Trạng thái hệ thống
              </label>
              <div class="select-wrapper">
                <select v-model="schoolStatus" class="mono-input">
                  <option value="active">✅ Hoạt động bình thường (Active)</option>
                  <option value="maintenance">🔧 Bảo trì hệ thống (Maintenance)</option>
                </select>
                <i class="pi pi-chevron-down select-arrow"></i>
              </div>
              <span class="form-help">Khi đặt bảo trì, sinh viên sẽ không thể đăng ký lớp hoặc tham gia thi.</span>
            </div>

            <!-- Cảnh báo bảo trì -->
            <div v-if="schoolStatus === 'maintenance'" class="maintenance-warning">
              <i class="pi pi-exclamation-triangle"></i>
              <div>
                <strong>Lưu ý:</strong> Chế độ bảo trì sẽ chặn mọi hoạt động của sinh viên. Hãy thông báo trước khi kích hoạt.
              </div>
            </div>
          </div>

          <div class="action-footer">
            <button type="button" class="btn-reset" @click="fetchConfigs" :disabled="submitLoading">
              <i class="pi pi-refresh"></i>
              Khôi phục
            </button>
            <button type="submit" class="btn-save" :disabled="submitLoading">
              <i v-if="submitLoading" class="pi pi-spin pi-spinner"></i>
              <i v-else class="pi pi-save"></i>
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </template>
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

/* ── Header ── */
.page-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.breadcrumb {
  font-size: 0.75rem;
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
  margin: 0 0 0.5rem 0;
  color: #111827;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

/* ── Alerts ── */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  border-radius: 8px;
}
.mono-alert i {
  font-size: 1.25rem;
  flex-shrink: 0;
}
.alert-error {
  background-color: #fef2f2;
  border: 2px solid #ef4444;
  color: #b91c1c;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
}
.alert-success {
  background-color: #f0fdf4;
  border: 2px solid #22c55e;
  color: #15803d;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
}

/* ── Stats Row ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem !important;
}
.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}
.icon-purple { background: #f3e8ff; color: #7c3aed; }
.icon-blue   { background: #dbeafe; color: #2563eb; }
.icon-green  { background: #dcfce7; color: #15803d; }
.icon-orange { background: #ffedd5; color: #c2410c; }

.stat-content {
  min-width: 0;
}
.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.semester-val {
  font-size: 0.95rem;
}
.stat-label {
  font-size: 0.78rem;
  color: #6b7280;
  font-weight: 500;
}

/* Status badges in stat card */
.status-badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.3rem 0.85rem;
  border-radius: 6px;
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.badge-active {
  background: #d1fae5;
  color: #065f46;
  border-color: #a7f3d0;
}
.badge-maintenance {
  background: #ffedd5;
  color: #92400e;
  border-color: #fcd34d;
}

/* ── Card ── */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.config-card {
  max-width: 720px;
}
.card-header {
  background-color: #f9fafb;
  color: #111827;
  padding: 1rem 1.5rem;
  font-weight: 600;
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
  padding: 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Forms ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.label-icon {
  color: #7c3aed;
  font-size: 0.9rem;
}
.mono-input {
  width: 100%;
  padding: 0.72rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #111827;
  outline: none;
  background-color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}
.mono-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}
.form-help {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Select */
.select-wrapper {
  position: relative;
}
select.mono-input {
  appearance: none;
  padding-right: 2.5rem;
  cursor: pointer;
}
.select-arrow {
  position: absolute;
  right: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.7rem;
  color: #6b7280;
}

/* Maintenance warning */
.maintenance-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.125rem;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #92400e;
}
.maintenance-warning i {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 2px;
}

/* ── Action Footer ── */
.action-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.btn-reset {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: normal;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fff;
  padding: 0.72rem 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-family: inherit;
}
.btn-reset:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}
.btn-save {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: normal;
  color: #fff;
  border: 1px solid #7c3aed;
  border-radius: 8px;
  background-color: #7c3aed;
  padding: 0.72rem 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-family: inherit;
}
.btn-save:hover:not(:disabled) {
  background-color: #6d28d9;
  border-color: #6d28d9;
  box-shadow: 0 4px 6px -1px rgba(109, 40, 217, 0.25);
}
.btn-save:disabled,
.btn-reset:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Loading ── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  color: #7c3aed;
  gap: 1rem;
}
.spinner {
  font-size: 2.5rem;
}
.loading-state div {
  font-weight: 600;
  font-size: 0.85rem;
  color: #6b7280;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .mono-wrapper { padding: 1rem; }
  .stats-row { grid-template-columns: 1fr; }
  .config-card { max-width: 100%; }
}
</style>
