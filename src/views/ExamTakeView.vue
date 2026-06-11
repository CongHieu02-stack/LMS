<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiGet, apiPost } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Lấy danh sách bài thi
const availableExams = ref<any[]>([])
const loading = ref(true)
const selectedExam = ref<any>(null)

// State
const isExamStarted = ref(false)
const isExamFinished = ref(false)
const cheatWarnings = ref(0)
const finalScore = ref<number | null>(null)
const timeLeft = ref(0)
let timerInterval: any = null
const showCheatOverlay = ref(false)
const showCheatForcedModal = ref(false)
const submitReasonMessage = ref<string | null>(null)

const questions = ref<any[]>([])
const answers = ref<Record<number, number>>({})

// Watch answers to auto-save state
watch(answers, () => {
  saveExamStateToStorage()
}, { deep: true })

// Watch selectedExam to dynamically hide sidebar when inside lobby/exam
watch(selectedExam, (newExam) => {
  authStore.isTakingExam = !!newExam
}, { immediate: true })

// Modal & Submission Confirmation State
const showConfirmModal = ref(false)
const answeredCount = computed(() => Object.keys(answers.value).length)

function triggerSubmitConfirmation() {
  showConfirmModal.value = true
}

async function confirmSubmit() {
  showConfirmModal.value = false
  await submitExam(false)
}

// ==========================================
// LOAD DATA
// ==========================================
async function loadExams() {
  loading.value = true
  try {
    // Lấy lớp đã đăng ký
    const regRes = await apiGet<{ success: boolean; data: any[] }>('/classes/my-registrations')
    const registeredClasses = regRes.data || []
    
    // Lấy bài kiểm tra của các lớp này
    let examsList: any[] = []
    for (const reg of registeredClasses) {
      const classId = reg.class?.id || reg.class_id
      if (classId) {
        try {
          const exRes = await apiGet<{ success: boolean; data: any[] }>(`/exam-manage/published/${classId}`)
          if (exRes.data && exRes.data.length > 0) {
            examsList.push(...exRes.data.map(e => ({
              ...e, 
              className: reg.class?.name || 'Lớp học',
              subjectName: reg.class?.subject?.name || 'Môn học'
            })))
          }
        } catch (e) { console.warn(e) }
      }
    }
    availableExams.value = examsList
  } catch (err) {
    console.error(err)
  }
  loading.value = false
}

// Storage Key
const storageKey = computed(() => {
  const studentId = authStore.profile?.id || 'guest'
  return `lms_active_exam_${studentId}`
})

// Save exam state to storage
function saveExamStateToStorage() {
  if (!selectedExam.value || isExamFinished.value) return
  const state = {
    selectedExam: selectedExam.value,
    questions: questions.value,
    answers: answers.value,
    timeLeft: timeLeft.value,
    cheatWarnings: cheatWarnings.value,
    isExamStarted: isExamStarted.value,
    showCheatOverlay: showCheatOverlay.value
  }
  localStorage.setItem(storageKey.value, JSON.stringify(state))
}

// Clear exam state from storage
function clearExamStateFromStorage() {
  localStorage.removeItem(storageKey.value)
}

// Load exam state from storage
function loadExamStateFromStorage() {
  const saved = localStorage.getItem(storageKey.value)
  if (saved) {
    try {
      const state = JSON.parse(saved)
      selectedExam.value = state.selectedExam
      questions.value = state.questions || []
      answers.value = state.answers || {}
      timeLeft.value = state.timeLeft || 0
      cheatWarnings.value = state.cheatWarnings || 0
      isExamStarted.value = state.isExamStarted || false
      showCheatOverlay.value = state.showCheatOverlay || false
      
      if (isExamStarted.value) {
        // Gắn lại event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange)
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        window.addEventListener('blur', handleWindowBlur)
        window.addEventListener('beforeunload', handleBeforeUnload)
        
        // Khởi chạy đồng hồ
        if (timerInterval) clearInterval(timerInterval)
        timerInterval = setInterval(() => {
          if (timeLeft.value > 0) {
            timeLeft.value--
            saveExamStateToStorage()
          } else {
            submitExam(false)
          }
        }, 1000)
      }
    } catch (e) {
      console.error('Failed to parse saved exam state:', e)
    }
  }
}

onMounted(async () => {
  await loadExams()
  loadExamStateFromStorage()
})

function selectExamToStart(exam: any) {
  selectedExam.value = exam
  // Gán ID duy nhất dựa trên index nếu câu hỏi không có id
  questions.value = (exam.questions || []).map((q: any, idx: number) => ({
    ...q,
    id: q.id !== undefined ? q.id : idx
  }))
  timeLeft.value = (exam.duration_minutes || 60) * 60
}

// ==========================================
// ANTI-CHEAT LOGIC
// ==========================================
function triggerCheatViolation() {
  if (isExamFinished.value || !isExamStarted.value) return
  if (showCheatOverlay.value || showCheatForcedModal.value) return // Tránh cộng dồn cảnh báo khi đang hiện overlay

  cheatWarnings.value++
  saveExamStateToStorage()

  if (cheatWarnings.value >= 2) {
    showCheatOverlay.value = false
    showCheatForcedModal.value = true
    submitExam(true)
  } else {
    showCheatOverlay.value = true
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    triggerCheatViolation()
  }
}

function handleWindowBlur() {
  triggerCheatViolation()
}

function handleFullscreenChange() {
  if (isExamStarted.value && !isExamFinished.value && !document.fullscreenElement) {
    if (!showCheatOverlay.value) {
      triggerCheatViolation()
    }
  }
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isExamStarted.value && !isExamFinished.value) {
    e.preventDefault()
    e.returnValue = ''
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

async function resumeExam() {
  showCheatOverlay.value = false
  saveExamStateToStorage()
  await enterFullscreen()
}

// ==========================================
// THAO TÁC THI
// ==========================================
async function startExam() {
  if (!selectedExam.value) return
  await enterFullscreen()
  isExamStarted.value = true
  
  // Gắn event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('beforeunload', handleBeforeUnload)

  saveExamStateToStorage()

  // Khởi chạy đồng hồ
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
      saveExamStateToStorage()
    } else {
      submitExam(false)
    }
  }, 1000)
}

async function submitExam(isForced = false) {
  clearInterval(timerInterval)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  
  clearExamStateFromStorage()
  showCheatOverlay.value = false

  if (isForced) {
    submitReasonMessage.value = 'Bài thi đã bị nộp do bạn vi phạm quy chế (rời màn hình quá 2 lần).'
  } else if (timeLeft.value <= 0) {
    submitReasonMessage.value = 'Thời gian làm bài đã hết. Bài thi của bạn đã được hệ thống tự động thu và nộp.'
  } else {
    submitReasonMessage.value = null
  }
  
  const answersList = Object.keys(answers.value).map(qid => ({
    question_id: parseInt(qid),
    selected_option: answers.value[parseInt(qid)]
  }))

  try {
    const res = await apiPost<{ success: boolean; data: any; score?: number }>('/exam/submit', {
      examTitle: selectedExam.value.title,
      examId: selectedExam.value.id,
      classId: selectedExam.value.class_id,
      answers: answersList,
      isForced,
      violations: cheatWarnings.value
    })
    
    // Backend tự động tính điểm và lưu vào grades table
    finalScore.value = res.score || 0

  } catch (err) {
    console.error('Submit error:', err)
  }

  isExamFinished.value = true
  exitFullscreen()
}

function closeExam() {
  selectedExam.value = null
  isExamStarted.value = false
  isExamFinished.value = false
  answers.value = {}
  questions.value = []
  cheatWarnings.value = 0
  authStore.isTakingExam = false
  router.push('/dashboard')
}

function confirmCheatRedirect() {
  showCheatForcedModal.value = false
}

// Format time
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getExamTypeLabel(type: string) {
  const labels: Record<string, string> = {
    regular: 'Thường xuyên',
    midterm: 'Giữa kỳ',
    final: 'Cuối kỳ'
  }
  return labels[type] || type
}

onUnmounted(() => {
  clearInterval(timerInterval)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  authStore.isTakingExam = false
})
</script>

<template>
  <div v-if="loading" class="mono-wrapper loading-view">
    <div class="ld"><i class="pi pi-spin pi-spinner"></i></div>
  </div>

  <!-- CHỌN BÀI THI -->
  <div v-else-if="!selectedExam" class="mono-wrapper lobby-view">
    <div class="page-header">
      <div>
        <div class="breadcrumb">Khảo thí / <span>Bài kiểm tra</span></div>
        <h1 class="page-title">Tham Gia Làm Bài Kiểm Tra</h1>
        <div class="page-subtitle">Danh sách các bài thi đang mở dành cho bạn.</div>
      </div>
    </div>
    
    <div v-if="availableExams.length === 0" class="empty-state">
      <i class="pi pi-inbox" style="font-size:3rem;color:#9ca3af"></i>
      <h3>Không có bài thi nào đang mở</h3>
    </div>
    
    <div class="grid-cards" v-else>
      <div v-for="e in availableExams" :key="e.id" class="mono-card">
        <div class="card-header"><span>{{ e.className }}</span></div>
        <div class="card-body">
          <h3 class="font-bold">{{ e.title }}</h3>
          <p class="text-sm text-gray-500 mb-4">{{ e.subjectName }}</p>
          <div class="info-row"><i class="pi pi-clock"></i> {{ e.duration_minutes }} phút</div>
          <div class="info-row">
            <span class="badge-exam-type" :class="'badge-' + (e.exam_type || 'other')">
              <i class="pi pi-file"></i> {{ getExamTypeLabel(e.exam_type) }}
            </span>
          </div>
          <button class="btn-submit w-full mt-4" @click="selectExamToStart(e)">Bắt đầu kiểm tra</button>
        </div>
      </div>
    </div>
  </div>

  <!-- LOBBY (Chưa bắt đầu) -->
  <div v-else-if="!isExamStarted" class="mono-wrapper lobby-view">
    <div class="mono-card max-w-lg mx-auto mt-10">
      <div class="card-header bg-primary-gradient text-white">
        <span>Bài thi: {{ selectedExam.title }}</span>
      </div>
      <div class="card-body">
        <h2 class="text-xl font-semibold mb-4 text-gray-900">Nội quy phòng thi</h2>
        <ul class="rules-list">
          <li><i class="pi pi-check text-green-600"></i> Thời gian làm bài: <strong>{{ selectedExam.duration_minutes }} phút</strong>.</li>
          <li><i class="pi pi-exclamation-triangle text-orange-500"></i> <strong>CHỐNG GIAN LẬN:</strong> Bài thi yêu cầu chạy ở chế độ Toàn Màn Hình (Full-screen).</li>
          <li><i class="pi pi-ban text-red-600"></i> Bất kỳ hành vi bấm Alt+Tab, mở tab mới, hay thu nhỏ trình duyệt sẽ bị hệ thống ghi nhận.</li>
          <li><i class="pi pi-info-circle text-blue-600"></i> Vi phạm lần 1 sẽ bị cảnh báo. Vi phạm lần 2 hệ thống tự động <strong>thu bài và cho điểm 0</strong>.</li>
        </ul>
        <div class="mt-6 flex-gap">
          <button class="btn-outline flex-1" @click="selectedExam = null">Trở lại</button>
          <button class="btn-submit flex-2" @click="startExam">
            <i class="pi pi-play"></i> Tôi đã hiểu & Bắt đầu
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- TRONG KHI THI -->
  <div v-else-if="!isExamFinished" class="exam-workspace">
    <!-- Topbar cố định -->
    <div class="exam-topbar">
      <div class="exam-title">{{ selectedExam.title }}</div>
      <div class="exam-timer" :class="{ 'text-red-600': timeLeft < 300 }">
        <i class="pi pi-clock"></i> {{ formatTime(timeLeft) }}
      </div>
      <button class="btn-outline" @click="triggerSubmitConfirmation">Nộp bài</button>
    </div>

    <!-- Nội dung câu hỏi -->
    <div class="exam-content">
      <div v-if="questions.length === 0" class="text-center py-10 text-gray-500">Bài thi chưa có nội dung câu hỏi.</div>
      <div class="mono-card mb-6" v-for="(q, index) in questions" :key="q.id">
        <div class="card-body">
          <h3 class="question-text">Câu {{ (index as number) + 1 }}: {{ q.text }}</h3>
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
      <p v-if="submitReasonMessage" class="text-red-500 font-semibold mb-4 px-4">{{ submitReasonMessage }}</p>
      <p class="text-gray-500 mb-6">Bạn đã hoàn thành bài thi: {{ selectedExam.title }}.</p>
      
      <div class="score-display">
        <span class="score-label">Điểm số ước tính</span>
        <span class="score-value" :class="finalScore! >= 5 ? 'text-green-600' : 'text-red-600'">
          {{ finalScore }} <small>/ 10</small>
        </span>
      </div>

      <button class="btn-submit mx-auto mt-8" @click="closeExam">
        Đóng và Trở về trang chủ
      </button>
    </div>
  </div>

  <!-- POPUP XÁC NHẬN NỘP BÀI -->
  <Transition name="fade">
    <div v-if="showConfirmModal" class="modal-overlay" @click.self="showConfirmModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <i class="pi pi-question-circle modal-icon"></i>
          <h3>Xác nhận nộp bài</h3>
        </div>
        <div class="modal-body">
          <p>Bạn đã trả lời được <strong>{{ answeredCount }}</strong> trên tổng số <strong>{{ questions.length }}</strong> câu hỏi.</p>
          <div class="warning-text mb-4" v-if="answeredCount < questions.length">
            <i class="pi pi-exclamation-triangle"></i> Cảnh báo: Bạn chưa trả lời hết các câu hỏi!
          </div>
          <p>Bạn có chắc chắn muốn nộp bài thi ngay bây giờ không?</p>
        </div>
        <div class="modal-footer">
          <button class="btn-outline" @click="showConfirmModal = false">Làm tiếp</button>
          <button class="btn-submit confirm-btn" @click="confirmSubmit">Nộp bài</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- POPUP CẢNH BÁO GIAN LẬN (CHẶN MÀN HÌNH THI) -->
  <Transition name="fade">
    <div v-if="showCheatOverlay" class="modal-overlay">
      <div class="modal-card" style="border-color: #ef4444;">
        <div class="modal-header" style="border-bottom: 1px solid #fee2e2;">
          <i class="pi pi-exclamation-triangle modal-icon" style="color: #ef4444;"></i>
          <h3 style="color: #ef4444;">CẢNH BÁO GIAN LẬN</h3>
        </div>
        <div class="modal-body" style="padding: 1.5rem 2rem;">
          <p class="font-semibold text-gray-900" style="font-size: 1.05rem; margin-bottom: 1rem;">
            Bạn vừa rời khỏi vùng làm bài (Alt+Tab, chuyển tab hoặc click ra ngoài cửa sổ).
          </p>
          <div class="warning-text mb-4" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;">
            <i class="pi pi-ban"></i> Số lần vi phạm hiện tại: <strong>{{ cheatWarnings }} / 2</strong>
          </div>
          <p class="text-sm text-gray-500">
            Chú ý: Quy chế phòng thi nghiêm cấm rời khỏi màn hình thi. Nếu vi phạm đủ 2 lần, bài làm sẽ bị hệ thống **tự động nộp** và kết thúc ngay lập tức.
          </p>
        </div>
        <div class="modal-footer" style="background: #fef2f2; border-top: 1px solid #fecaca;">
          <button 
            v-if="cheatWarnings < 2"
            class="btn-submit w-full" 
            style="background: #dc2626; border-color: #dc2626; width: 100%;" 
            @click="resumeExam"
          >
            <i class="pi pi-play"></i> Tôi đã hiểu & Tiếp tục làm bài
          </button>
          <div v-else class="text-center w-full font-bold" style="color: #dc2626; width: 100%; text-align: center;">
            Hệ thống đang tự động thu bài...
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- POPUP CHI TIẾT CẢNH BÁO GIAN LẬN LẦN 2 (BẮT BUỘC NỘP BÀI) -->
  <Transition name="fade">
    <div v-if="showCheatForcedModal" class="modal-overlay">
      <div class="modal-card" style="border-color: #ef4444; max-width: 30rem;">
        <div class="modal-header" style="border-bottom: 1px solid #fee2e2;">
          <i class="pi pi-exclamation-circle modal-icon" style="color: #ef4444; font-size: 1.75rem;"></i>
          <h3 style="color: #ef4444; font-weight: 700;">ĐÃ ĐÌNH CHỈ LÀM BÀI</h3>
        </div>
        <div class="modal-body" style="padding: 1.5rem 2rem;">
          <p class="font-bold text-red-600 mb-2" style="font-size: 1.1rem; line-height: 1.4;">
            Bạn đã vi phạm quy chế thi lần thứ 2!
          </p>
          <p class="text-gray-700 mb-4" style="line-height: 1.6;">
            Hành vi rời khỏi vùng làm bài (Alt+Tab, chuyển tab, thoát toàn màn hình hoặc click ra ngoài) đã được hệ thống ghi nhận. 
            <strong>Bài thi của bạn đã bị khóa và tự động nộp bài ngay lập tức.</strong>
          </p>
          <div class="warning-text mb-4" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 0.75rem 1rem; border-radius: 8px; font-weight: 600;">
            <i class="pi pi-info-circle"></i> Vui lòng xác nhận bên dưới để xem điểm số kết quả bài thi của bạn.
          </div>
        </div>
        <div class="modal-footer" style="background: #fef2f2; border-top: 1px solid #fecaca; padding: 1rem 1.5rem 1.5rem;">
          <button 
            class="btn-submit w-full" 
            style="background: #dc2626; border-color: #dc2626; font-weight: 600; font-size: 1rem; width: 100%;" 
            @click="confirmCheatRedirect"
          >
            <i class="pi pi-check"></i> Xác nhận & Xem điểm số
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mono-wrapper { animation: fadeIn 0.3s ease-out; }

.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; } .breadcrumb span { color: var(--lms-gray-900, #111827); font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: var(--lms-gray-900, #111827); }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.ld { display: flex; justify-content: center; padding: 4rem; font-size: 2rem; color: #6b7280; }
.empty-state { text-align: center; padding: 4rem; color: #6b7280; }

.grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }

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
.font-bold { font-weight: 700; font-size: 1.1rem; color: #111827; margin-bottom: 0.25rem; }
.text-sm { font-size: 0.85rem; }
.text-gray-900 { color: #111827; }
.text-gray-500 { color: #6b7280; }
.text-green-600 { color: #166534; }
.text-green-500 { color: #22c55e; }
.text-red-600 { color: #dc2626; }
.text-orange-500 { color: #f97316; }
.text-blue-600 { color: #2563eb; }
.py-10 { padding-top: 2.5rem; padding-bottom: 2.5rem; }
.w-full { width: 100%; }
.flex-gap { display: flex; gap: 1rem; }
.flex-1 { flex: 1; } .flex-2 { flex: 2; }
.info-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #4b5563; }
.badge-exam-type {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
  gap: 0.25rem;
}
.badge-regular {
  background: #e0f2fe;
  color: #0369a1;
}
.badge-midterm {
  background: #fef3c7;
  color: #92400e;
}
.badge-final {
  background: #dcfce7;
  color: #15803d;
}

/* Card */
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.bg-primary-gradient {
  background: linear-gradient(135deg, var(--lms-primary, #4f46e5) 0%, var(--lms-primary-hover, #4338ca) 100%) !important;
}
.text-white { color: #fff !important; }
.card-header { padding: 1rem 1.5rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; background: #f9fafb; color: #111827; }
.card-body { padding: 1.5rem; }

/* Buttons */
.btn-submit {
  padding: 0.75rem 1.5rem; border: 1px solid var(--lms-primary, #4f46e5); background: var(--lms-primary, #4f46e5); color: #fff;
  border-radius: 8px; font-weight: 500; font-size: 0.95rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s;
}
.btn-submit:hover { background: var(--lms-primary-hover, #4338ca); border-color: var(--lms-primary-hover, #4338ca); box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15); }
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
.radio-input:checked + .option-box { border-color: var(--lms-primary, #4f46e5); background: var(--lms-primary-light, #e0e7ff); font-weight: 500; color: var(--lms-primary-hover, #4338ca); }

/* Result */
.result-icon { font-size: 4rem; }
.score-display { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: inline-block; }
.score-label { display: block; font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
.score-value { font-size: 3rem; font-weight: 600; line-height: 1; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Custom Confirmation Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(17, 24, 39, 0.6);
  backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-overlay .modal-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid #e5e7eb;
  width: 100%;
  max-width: 28rem;
  overflow: hidden;
  animation: modalScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1.5rem 1.5rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.modal-icon {
  font-size: 1.5rem;
  color: var(--lms-primary, #4f46e5);
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.6;
}

.modal-body p {
  margin: 0 0 0.75rem 0;
}

.modal-body p:last-child {
  margin-bottom: 0;
}

.warning-text {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #b45309;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.confirm-btn {
  background: var(--lms-primary, #4f46e5);
  border-color: var(--lms-primary, #4f46e5);
}

.confirm-btn:hover {
  background: var(--lms-primary-hover, #4338ca);
  border-color: var(--lms-primary-hover, #4338ca);
}

@keyframes modalScale {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Transition Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
