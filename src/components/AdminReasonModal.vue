<!-- ============================================================================
     AdminReasonModal.vue — Component Modal chung nhập lý do quản trị
     Được bọc gọn gàng quanh ReasonDialog (PrimeVue Dialog) để tái sử dụng mã nguồn.
     ============================================================================ -->
<script setup lang="ts">
import { computed } from 'vue'
import ReasonDialog from './ReasonDialog.vue'

const props = defineProps<{
  show: boolean
  title: string
  modelValue: string
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'close'): void
}>()

const reasonVal = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <ReasonDialog
    :visible="show"
    :title="title"
    v-model="reasonVal"
    :submitting="submitting"
    :error="error"
    @submit="emit('submit')"
    @close="emit('close')"
  />
</template>
