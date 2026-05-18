<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const isExamStarted = ref(false)
const isExamFinished = ref(false)
const cheatWarnings = ref(0)
const finalScore = ref<number | null>(null)
const timeLeft = ref(60 * 60) // 60 phút tính bằng giây
let timerInterval: any = null

// Data giả lập
const questions = [
  { id: 1, text: 'Thủ đô của Việt Nam là?', options: ['Hà Nội', 'Đà Nẵng', 'TP.HCM', 'Huế'], answer: 0 },
  { id: 2, text: 'Ngôn ngữ lập trình nào phổ biến cho AI?', options: ['Java', 'C++', 'Python', 'PHP'], answer: 2 },
  { id: 3, text: 'Vue 3 sử dụng API nào mới để quản lý State?', options: ['Options API', 'Composition API', 'Class API', 'Hooks'], answer: 1 },
]
const answers = ref<Record<number, number>>({})

// ==========================================
// ANTI-CHEAT LOGIC
// ==========================================
function handleVisibilityChange() {
  if (isExamStarted.value && !isExamFinished.value && document.visibilityState === 'hidden') {
    cheatWarnings.value++
    if (cheatWarnings.value >= 2) {
      alert('PHÁT HIỆN GIAN LẬN: Bạn đã thoát khỏi màn hình làm bài quá 2 lần. Bài thi sẽ tự động thu lại!')
      submitExam()
    } else {
      alert(`CẢNH BÁO LẦN 1: Bạn vừa Alt+Tab hoặc rời khỏi màn hình làm bài. 
Nghiêm cấm thoát màn hình khi đang thi. Nếu tái phạm, bài thi sẽ bị thu ngay lập tức!`)
    }
  }
}

function handleFullscreenChange() {
  if (isExamStarted.value && !isExamFinished.value && !document.fullscreenElement) {
    cheatWarnings.value++
    if (cheatWarnings.value >= 2) {
      alert('PHÁT HIỆN GIAN LẬN: Bạn đã thoát chế độ Toàn Màn Hình. Bài thi bị thu lại!')
      submitExam()
    } else {
      alert('CẢNH BÁO: Bắt buộc phải làm bài ở chế độ Toàn Màn Hình. Vui lòng bật lại để tiếp tục!')
      enterFullscreen()
    }
  }
}

async function enterFullscreen() {
  try {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      await elem.requestFullscreen()
    }
  } catch (err) {
    console.error('Lỗi khi mở Fullscreen:', err)
  }
}

async function exitFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  }
}

// ==========================================
// THAO TÁC THI
// ==========================================
async function startExam() {
  await enterFullscreen()
  isExamStarted.value = true
  
  // Gắn event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // Khởi chạy đồng hồ
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      alert('Hết thời gian làm bài! Hệ thống tự động thu bài.')
      submitExam()
    }
  }, 1000)
}

function submitExam() {
  clearInterval(timerInterval)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  
  // Tính điểm giả lập
  let correct = 0
  questions.forEach(q => {
    if (answers.value[q.id] === q.answer) correct++
  })
  finalScore.value = parseFloat(((correct / questions.length) * 10).toFixed(1))
  
  isExamFinished.value = true
  exitFullscreen()
}

function closeExam() {
  router.push('/dashboard')
}

// Format time
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

onUnmounted(() => {
  clearInterval(timerInterval)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <!-- LOBBY (Chưa bắt đầu) -->
  <div v-if="!isExamStarted" class="mono-wrapper lobby-view">
    <div class="mono-card max-w-lg mx-auto mt-10">
      <div class="card-header bg-gray-900 text-white">
        <span>Kỳ thi Cuối kỳ - Môn: Trí Tuệ Nhân Tạo</span>
      </div>
      <div class="card-body">
        <h2 class="text-xl font-semibold mb-4 text-gray-900">Nội quy phòng thi</h2>
        <ul class="rules-list">
          <li><i class="pi pi-check text-green-600"></i> Thời gian làm bài: <strong>60 phút</strong>.</li>
          <li><i class="pi pi-exclamation-triangle text-orange-500"></i> <strong>CHỐNG GIAN LẬN:</strong> Bài thi yêu cầu chạy ở chế độ Toàn Màn Hình (Full-screen).</li>
          <li><i class="pi pi-ban text-red-600"></i> Bất kỳ hành vi bấm Alt+Tab, mở tab mới, hay thu nhỏ trình duyệt sẽ bị hệ thống ghi nhận.</li>
          <li><i class="pi pi-info-circle text-blue-600"></i> Vi phạm lần 1 sẽ bị cảnh báo. Vi phạm lần 2 hệ thống tự động <strong>thu bài và cho điểm 0</strong>.</li>
        </ul>
        <div class="mt-6">
          <button class="btn-submit w-full" @click="startExam">
            <i class="pi pi-play"></i> Tôi đã hiểu & Bắt đầu làm bài
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- TRONG KHI THI -->
  <div v-else-if="!isExamFinished" class="exam-workspace">
    <!-- Topbar cố định -->
    <div class="exam-topbar">
      <div class="exam-title">INT101 - Trí tuệ nhân tạo (Mã đề: 001)</div>
      <div class="exam-timer" :class="{ 'text-red-600': timeLeft < 300 }">
        <i class="pi pi-clock"></i> {{ formatTime(timeLeft) }}
      </div>
      <button class="btn-outline" @click="submitExam">Nộp bài sớm</button>
    </div>

    <!-- Nội dung câu hỏi -->
    <div class="exam-content">
      <div class="mono-card mb-6" v-for="(q, index) in questions" :key="q.id">
        <div class="card-body">
          <h3 class="question-text">Câu {{ index + 1 }}: {{ q.text }}</h3>
          <div class="options-grid">
            <label v-for="(opt, optIndex) in q.options" :key="optIndex" class="option-label">
              <input type="radio" :name="`q_${q.id}`" :value="optIndex" v-model="answers[q.id]" class="radio-input" />
              <span class="option-box">{{ opt }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- KẾT QUẢ THI -->
  <div v-else class="mono-wrapper result-view">
    <div class="mono-card max-w-md mx-auto mt-10 text-center py-10">
      <i class="pi pi-check-circle text-green-500 result-icon"></i>
      <h2 class="text-2xl font-semibold mt-4 mb-2">Đã Nộp Bài Thành Công</h2>
      <p class="text-gray-500 mb-6">Bạn đã hoàn thành bài thi môn Trí tuệ nhân tạo.</p>
      
      <div class="score-display">
        <span class="score-label">Điểm số của bạn</span>
        <span class="score-value" :class="finalScore! >= 5 ? 'text-green-600' : 'text-red-600'">
          {{ finalScore }} <small>/ 10</small>
        </span>
      </div>

      <button class="btn-submit mx-auto mt-8" @click="closeExam">
        Đóng và Trở về trang chủ
      </button>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 2rem; animation: fadeIn 0.3s ease-out; background: #f3f4f6; min-height: 100vh; }

/* Utilities */
.max-w-lg { max-width: 32rem; }
.max-w-md { max-width: 28rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.mt-10 { margin-top: 2.5rem; }
.mt-8 { margin-top: 2rem; }
.mt-6 { margin-top: 1.5rem; }
.mt-4 { margin-top: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.text-center { text-align: center; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.font-semibold { font-weight: 600; }
.text-gray-900 { color: #111827; }
.text-gray-500 { color: #6b7280; }
.text-green-600 { color: #166534; }
.text-green-500 { color: #22c55e; }
.text-red-600 { color: #dc2626; }
.text-orange-500 { color: #f97316; }
.text-blue-600 { color: #2563eb; }
.py-10 { padding-top: 2.5rem; padding-bottom: 2.5rem; }
.w-full { width: 100%; }

/* Card */
.mono-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
  overflow: hidden;
}
.bg-gray-900 { background: #111827 !important; }
.text-white { color: #fff !important; }
.card-header { padding: 1rem 1.5rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
.card-body { padding: 1.5rem; }

/* Buttons */
.btn-submit {
  padding: 0.75rem 1.5rem; border: 1px solid #111827; background: #111827; color: #fff;
  border-radius: 8px; font-weight: 500; font-size: 0.95rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;
}
.btn-submit:hover { background: #374151; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.btn-outline {
  padding: 0.5rem 1rem; border: 1px solid #e5e7eb; background: #fff; color: #111827;
  border-radius: 6px; font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.btn-outline:hover { background: #f9fafb; border-color: #d1d5db; }

/* Rules List */
.rules-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; }
.rules-list li { display: flex; align-items: flex-start; gap: 0.75rem; font-size: 0.95rem; line-height: 1.5; color: #374151; }
.rules-list i { margin-top: 0.2rem; }

/* Exam Workspace */
.exam-workspace { min-height: 100vh; background: #f9fafb; display: flex; flex-direction: column; }
.exam-topbar {
  background: #fff; border-bottom: 1px solid #e5e7eb; padding: 1rem 2rem;
  display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.exam-title { font-weight: 600; font-size: 1.1rem; color: #111827; }
.exam-timer { font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; font-family: monospace; }
.exam-content { max-width: 48rem; margin: 2rem auto; width: 100%; padding: 0 1rem; flex-grow: 1; }

/* Questions */
.question-text { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 1.5rem 0; line-height: 1.5; }
.options-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.option-label { display: flex; align-items: center; cursor: pointer; }
.radio-input { display: none; }
.option-box {
  width: 100%; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; transition: all 0.2s; color: #374151;
}
.option-label:hover .option-box { border-color: #d1d5db; background: #f9fafb; }
.radio-input:checked + .option-box { border-color: #7c3aed; background: #faf5ff; font-weight: 500; color: #6d28d9; }

/* Result */
.result-icon { font-size: 4rem; }
.score-display { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: inline-block; }
.score-label { display: block; font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
.score-value { font-size: 3rem; font-weight: 600; line-height: 1; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
