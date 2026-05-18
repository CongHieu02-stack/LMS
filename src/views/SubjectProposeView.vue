<script setup lang="ts">
import { ref } from 'vue'

// State
const formCode = ref('')
const formName = ref('')
const formCredits = ref(3)
const formDescription = ref('')
const isSubmitting = ref(false)
const successMessage = ref<string | null>(null)

// Hàm nộp đề xuất (Mock UI)
async function handleSubmit() {
  isSubmitting.value = true
  successMessage.value = null
  
  // Giả lập call API 1 giây
  setTimeout(() => {
    isSubmitting.value = false
    successMessage.value = 'Đề xuất môn học đã được gửi tới Ban Giám Hiệu để phê duyệt.'
    // Reset
    formCode.value = ''
    formName.value = ''
    formCredits.value = 3
    formDescription.value = ''
  }, 1000)
}
</script>

<template>
  <div class="mono-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">
          Quản lý Môn học / <span>Đề xuất Môn học</span>
        </div>
        <h1 class="page-title">Đề xuất Môn học Mới</h1>
        <div class="page-subtitle">Điền thông tin chi tiết để nộp đề xuất mở môn học mới cho học kỳ tới.</div>
      </div>
    </div>

    <div v-if="successMessage" class="mono-alert alert-success mb-6">
      <i class="pi pi-check-circle"></i>
      <div><strong>THÀNH CÔNG:</strong> {{ successMessage }}</div>
    </div>

    <!-- Form Split Layout -->
    <div class="split-layout">
      <!-- Cột Trái: Form nhập liệu -->
      <div class="mono-card flex-grow">
        <div class="card-header">
          <span>Thông tin môn học</span>
          <i class="pi pi-book text-gray-400"></i>
        </div>
        
        <form @submit.prevent="handleSubmit" class="card-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mã môn học</label>
              <input 
                v-model="formCode" 
                type="text" 
                class="mono-input uppercase-input" 
                placeholder="VD: INT101" 
                required 
              />
            </div>
            <div class="form-group">
              <label class="form-label">Số tín chỉ</label>
              <input 
                v-model="formCredits" 
                type="number" 
                min="1" max="10"
                class="mono-input" 
                required 
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tên môn học</label>
            <input 
              v-model="formName" 
              type="text" 
              class="mono-input" 
              placeholder="VD: Nhập môn Trí tuệ nhân tạo" 
              required 
            />
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả tóm tắt (Đề cương)</label>
            <textarea 
              v-model="formDescription" 
              class="mono-input textarea-tall" 
              placeholder="Nhập mục tiêu và nội dung tóm tắt của môn học..." 
              required 
            ></textarea>
          </div>

          <div class="action-footer">
            <button type="submit" class="btn-submit" :disabled="isSubmitting">
              <i v-if="isSubmitting" class="pi pi-spin pi-spinner"></i>
              <i v-else class="pi pi-send"></i>
              Gửi Đề Xuất
            </button>
          </div>
        </form>
      </div>

      <!-- Cột Phải: Hướng dẫn / Quy định -->
      <div class="guideline-panel">
        <div class="mono-card bg-gray-50 border-dashed">
          <div class="card-body">
            <h3 class="guideline-title"><i class="pi pi-info-circle"></i> Quy định đề xuất</h3>
            <ul class="guideline-list">
              <li><strong>Mã môn học:</strong> Bắt buộc viết hoa, có độ dài từ 5-8 ký tự, không chứa ký tự đặc biệt.</li>
              <li><strong>Số tín chỉ:</strong> Phải phù hợp với quy chế đào tạo tín chỉ (thường từ 2-4 TC).</li>
              <li><strong>Phê duyệt:</strong> Môn học mới cần được Hiệu trưởng hoặc PĐT phê duyệt trước khi được đưa vào đăng ký lớp.</li>
            </ul>
          </div>
        </div>
      </div>
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
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.breadcrumb {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
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

/* Alerts */
.mono-alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
}
.alert-success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}
.mb-6 { margin-bottom: 1.5rem; }

/* Layout */
.split-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}
.flex-grow { flex: 1; }
.guideline-panel {
  width: 350px;
  flex-shrink: 0;
}

/* Card Minimalist */
.mono-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bg-gray-50 { background-color: #f9fafb; }
.border-dashed { border-style: dashed; border-color: #d1d5db; box-shadow: none; }
.card-header {
  background-color: #f9fafb;
  color: #111827;
  padding: 1rem 1.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Form Elements */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-label {
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
  transition: all 0.2s;
  color: #1f2937;
}
.mono-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}
.uppercase-input { text-transform: uppercase; }
.textarea-tall { min-height: 120px; resize: vertical; }

/* Buttons */
.action-footer {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}
.btn-submit {
  padding: 0.6rem 1.5rem;
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.btn-submit:hover:not(:disabled) {
  background: #374151;
  border-color: #374151;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}
.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

/* Guidelines */
.guideline-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.guideline-list {
  margin: 0;
  padding-left: 1.2rem;
  color: #4b5563;
  font-size: 0.85rem;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.guideline-list strong { color: #111827; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1024px) {
  .split-layout { flex-direction: column; }
  .guideline-panel { width: 100%; }
}
</style>
