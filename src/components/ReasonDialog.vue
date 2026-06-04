<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'

const props = defineProps<{
  visible: boolean
  title: string
  actionType?: 'DUYET' | 'TU_CHOI' | 'KHOA' | null
  modelValue: string // reason or password
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'close'): void
}>()

const textVal = computed({
  get: () => props.modelValue || '',
  set: (val) => emit('update:modelValue', val)
})

function handleSubmit() {
  if (props.submitting || !textVal.value.trim()) return
  emit('submit')
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="title"
    :closable="!submitting"
    @update:visible="(val) => !val && emit('close')"
    class="lms-reason-dialog"
    :style="{ width: '450px' }"
  >
    <div class="dialog-body mt-sm">
      <div v-if="error" class="error-banner mb-md">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ error }}</span>
      </div>

      <p class="dialog-desc mb-md">
        Hành động này bắt buộc phải nhập lý do chi tiết để hệ thống lưu lịch sử kiểm duyệt.
      </p>

      <div class="form-group flex flex-col gap-sm">
        <label class="form-label font-semibold text-sm">
          NỘI DUNG LÝ DO
          <span class="text-danger">*</span>
        </label>
        
        <textarea
          v-model="textVal"
          class="lms-textarea w-full"
          placeholder="Nhập lý do chi tiết tại đây..."
          rows="4"
          required
          :disabled="submitting"
          autofocus
        ></textarea>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer flex justify-end w-full mt-md">
        <button
          type="button"
          class="lms-btn lms-btn-secondary"
          @click="emit('close')"
          :disabled="submitting"
        >
          Hủy bỏ
        </button>
        <button
          type="button"
          class="lms-btn lms-btn-primary"
          @click="handleSubmit"
          :disabled="submitting || !textVal.trim()"
        >
          <span v-if="submitting">
            <i class="pi pi-spin pi-spinner mr-1"></i> Đang xử lý...
          </span>
          <span v-else>Xác nhận</span>
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.lms-reason-dialog {
  font-family: var(--lms-font);
}

.dialog-desc {
  font-size: 0.875rem;
  color: var(--lms-gray-600);
  line-height: 1.5;
}

.error-banner {
  background-color: var(--lms-danger-light);
  color: var(--lms-danger);
  border: 1px solid #fca5a5;
  border-radius: var(--lms-radius);
  padding: 10px 12px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-label {
  color: var(--lms-gray-700);
}

.lms-input,
.lms-textarea {
  font-family: var(--lms-font);
  font-size: 0.9rem;
  border: 1px solid var(--lms-gray-300);
  border-radius: var(--lms-radius);
  padding: 10px 12px;
  outline: none;
  background-color: var(--lms-white);
  color: var(--lms-gray-900);
  transition: var(--lms-transition);
}

.lms-input:focus,
.lms-textarea:focus {
  border-color: var(--lms-primary);
  box-shadow: 0 0 0 2px var(--lms-primary-light);
}

.lms-textarea {
  resize: vertical;
}

.text-danger {
  color: var(--lms-danger);
}

.dialog-footer {
  display: flex;
  gap: 12px;
}

.dialog-body {
  padding-top: 10px;
}
</style>
