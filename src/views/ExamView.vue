<!-- ============================================================================
  ExamView.vue — Giao diện làm bài thi (Có chống gian lận)
  Trách nhiệm DUY NHẤT: Render bộ câu hỏi, cho phép chọn đáp án, và nộp bài.
  Tích hợp useAntiCheat để giám sát người dùng.
  ============================================================================ -->

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiPost } from '@/lib/api'
import { useToast } from 'primevue/usetoast'
import { useAntiCheat } from '@/composables/useAntiCheat'
import Card from 'primevue/card'
import Button from 'primevue/button'

const toast = useToast()
const router = useRouter()

const examTitle = 'Bài thi cuối kỳ: Lập trình Web'
const questions = [
  { id: 1, text: 'Vue 3 sử dụng API nào để thay thế Options API?', options: ['Composition API', 'Hooks API', 'React API', 'Setup API'] },
  { id: 2, text: 'Pinia khác gì Vuex?', options: ['Hỗ trợ TypeScript tốt hơn', 'Không có Mutations', 'Cả hai đáp án trên', 'Không khác gì'] }
]

const answers = ref<Record<number, string>>({})
const submitting = ref(false)

// ─── NỘP BÀI ───
async function doSubmit(isForced: boolean) {
  if (submitting.value) return
  submitting.value = true

  const formattedAnswers = Object.keys(answers.value).map(qId => ({
    questionId: parseInt(qId),
    answer: answers.value[parseInt(qId)]
  }))

  try {
    const res = await apiPost<{ success: boolean, message: string }>('/exam/submit', {
      examTitle,
      answers: formattedAnswers,
      isForced,
      violations: violationCount.value
    })

    if (isForced) {
      toast.add({ severity: 'error', summary: 'Đình chỉ thi', detail: res.message, life: 5000 })
    } else {
      toast.add({ severity: 'success', summary: 'Hoàn thành', detail: res.message, life: 3000 })
    }

    // Trở về dashboard sau một lát
    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: err.message, life: 3000 })
    submitting.value = false
  }
}

// Hàm gói để gọi nộp bài bình thường
async function submitExam() {
  await doSubmit(false)
}

// ─── ANTI-CHEAT ───
const { violationCount, isLocked } = useAntiCheat({
  maxViolations: 3,
  onForceSubmit: () => doSubmit(true), // Nộp bắt buộc
  onViolation: (count) => {
    toast.add({
      severity: 'warn',
      summary: 'Cảnh báo vi phạm!',
      detail: `Bạn đã chuyển tab hoặc rời cửa sổ. Vi phạm lần ${count}/3.`,
      life: 5000
    })
  }
})
</script>

<template>
  <div class="exam-page">
    <div class="page-header">
      <h1>{{ examTitle }}</h1>
      <div class="violation-badge" :class="{ 'warning': violationCount > 0 }">
        Số lần vi phạm: <span>{{ violationCount }} / 3</span>
      </div>
    </div>

    <div class="quiz-container">
      <Card v-for="(q, index) in questions" :key="q.id" class="question-card mb-md">
        <template #title>Câu {{ index + 1 }}: {{ q.text }}</template>
        <template #content>
          <div class="options-list">
            <label v-for="opt in q.options" :key="opt" class="option-label">
              <input 
                type="radio" 
                :name="`q-${q.id}`" 
                :value="opt" 
                v-model="answers[q.id]" 
                :disabled="isLocked || submitting" 
              />
              <span class="option-text">{{ opt }}</span>
            </label>
          </div>
        </template>
      </Card>

      <div class="actions">
        <Button
          label="Hoàn tất nộp bài"
          icon="pi pi-check"
          severity="contrast"
          class="submit-btn"
          :loading="submitting"
          :disabled="isLocked || submitting"
          @click="submitExam"
        />
      </div>
    </div>

    <!-- Màn hình khóa khi gian lận -->
    <div v-if="isLocked" class="lms-overlay-cheat">
      <h2>ĐÌNH CHỈ THI</h2>
      <p>Bài thi của bạn đã bị khóa và tự động nộp vì phát hiện hành vi chuyển tab / mất focus cửa sổ quá 3 lần.</p>
      <div class="lms-spinner mt-md"></div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--lms-space-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  font-size: 1.8rem;
  color: var(--lms-black-pure);
}

.violation-badge {
  font-weight: 700;
  font-size: 0.85rem;
  padding: 6px 12px;
  background: var(--lms-white);
  border: var(--lms-border-strong);
  border-radius: var(--lms-radius);
  color: var(--lms-black);
}

.violation-badge.warning {
  background: var(--lms-black);
  color: var(--lms-white);
}

.violation-badge span {
  margin-left: 4px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--lms-space-sm);
  margin-top: var(--lms-space-sm);
}

.option-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--lms-radius);
  transition: var(--lms-transition);
}

.option-label:hover {
  background: var(--lms-gray-100);
  border-color: var(--lms-gray-300);
}

.option-text {
  font-size: 0.95rem;
  color: var(--lms-black);
}

.actions {
  margin-top: var(--lms-space-xl);
  display: flex;
  justify-content: flex-end;
}

.submit-btn {
  padding: 12px 24px !important;
  font-size: 1rem !important;
}
</style>
