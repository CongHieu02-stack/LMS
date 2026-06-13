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
const startedAt = ref<string | null>(null)
let timerInterval: any = null
const showCheatOverlay = ref(false)
const showCheatForcedModal = ref(false)
const submitReasonMessage = ref<string | null>(null)

const questions = ref<any[]>([])
const answers = ref<Record<number, number>>({})

// === TRẠNG THÁI XEM LẠI BÀI THI ===
const showDetailModal = ref(false)
const loadingDetail = ref(false)
const selectedDetail = ref<any>(null)
const mySubmissions = ref<any[]>([])

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
              subjectName: reg.class?.subjectName || 'Môn học'
            })))
          }
        } catch (e) { console.warn(e) }
      }
    }

    // Lấy danh sách bài đã nộp để đánh dấu hoàn thành
    try {
      const subRes = await apiGet<{ success: boolean; data: any[] }>('/exam/my-submissions')
      mySubmissions.value = subRes.data || []
    } catch (e) { 
      console.warn('Could not load submissions:', e)
      mySubmissions.value = []
    }

    // Kết hợp: gắn cờ isCompleted, submissionId, score lên từng bài thi
    availableExams.value = examsList.map(exam => {
      const submission = mySubmissions.value.find((s: any) => s.examId === exam.id || s.exam_id === exam.id)
      return {
        ...exam,
        isCompleted: !!submission,
        submissionId: submission?.id || null,
        studentScore: submission?.score ?? null,
        submittedAt: submission?.submittedAt || submission?.submitted_at || null
      }
    })
  } catch (err) {
    console.error(err)
  }
  loading.value = false
}

// === XEM LẠI BÀI THI ===
async function viewSubmissionDetail(exam: any) {
  if (!exam.submissionId) return
  loadingDetail.value = true
  showDetailModal.value = true
  try {
    const res = await apiGet<any>(`/exam/submission/${exam.submissionId}`)
    selectedDetail.value = {
      examTitle: res.submission?.examTitle || exam.title,
      score: res.submission?.score ?? exam.studentScore,
      violations: res.submission?.violations || 0,
      isForced: res.submission?.isForced || false,
      submittedAt: res.submission?.submittedAt || '',
      startedAt: res.submission?.startedAt || '',
      answers: res.submission?.answers || [],
      questions: res.questions || [],
      showAnswers: res.showAnswers !== false
    }
  } catch (err) {
    console.error('Error loading submission detail:', err)
    selectedDetail.value = null
  }
  loadingDetail.value = false
}

function closeDetailModal() {
  showDetailModal.value = false
  selectedDetail.value = null
}

function getStudentAnswer(detail: any, qIndex: number) {
  if (!detail?.answers) return null
  const ans = detail.answers[qIndex]
  if (ans === undefined || ans === null) return null
  // answer can be { selected_option: number } or just a number
  return ans.selected_option ?? ans.answer ?? ans
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    showCheatOverlay: showCheatOverlay.value,
    startedAt: startedAt.value
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
      startedAt.value = state.startedAt || null
      
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
  startedAt.value = new Date().toISOString()
  
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
      violations: cheatWarnings.value,
      startedAt: startedAt.value
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
  // Reload để cập nhật trạng thái hoàn thành
  loadExams()
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

function scrollToQuestion(index: number) {
  const el = document.getElementById(`question-card-${index}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
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
      <div 
        v-for="e in availableExams" :key="e.id" 
        class="mono-card" 
      >
        <div class="card-header">
          <span>{{ e.className }}</span>
          <span v-if="e.isCompleted" class="completed-badge">
            <i class="pi pi-check-circle"></i> Đã hoàn thành
          </span>
        </div>
        <div class="card-body">
          <h3 class="font-bold">{{ e.title }}</h3>
          <p class="text-sm text-gray-500 mb-4">{{ e.subjectName }}</p>
          <div class="info-row"><i class="pi pi-clock"></i> {{ e.duration_minutes }} phút</div>
          <div class="info-row"><i class="pi pi-list"></i> Số câu hỏi: {{ e.questions?.length || 0 }} câu</div>
          <div class="info-row">
            <span class="badge-exam-type" :class="'badge-' + (e.exam_type || 'other')">
              <i class="pi pi-file"></i> {{ getExamTypeLabel(e.exam_type) }}
            </span>
          </div>

          <!-- Hiển thị điểm nếu đã hoàn thành -->
          <div v-if="e.isCompleted" class="score-inline">
            <div class="score-inline-main">
              <span class="score-inline-label">Điểm số:</span>
              <span class="score-inline-value" :class="e.studentScore >= 5 ? 'score-pass' : 'score-fail'">
                {{ e.studentScore }} <small>/ 10</small>
              </span>
            </div>
            <div v-if="e.submittedAt" class="submission-time-label">
              Đã nộp: {{ formatDateTime(e.submittedAt) }}
            </div>
          </div>

          <!-- Nút hành động -->
          <button 
            v-if="!e.isCompleted" 
            class="btn-submit w-full mt-4" 
            @click="selectExamToStart(e)"
          >
            Bắt đầu kiểm tra
          </button>
          <button 
            v-else 
            class="btn-review w-full mt-4" 
            @click="viewSubmissionDetail(e)"
          >
            <i class="pi pi-eye"></i> Xem lại bài làm
          </button>
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

    <!-- Layout Container -->
    <div class="exam-layout-container">
      <!-- Nội dung câu hỏi (bên trái) -->
      <div class="exam-questions-area">
        <div v-if="questions.length === 0" class="text-center py-10 text-gray-500">Bài thi chưa có nội dung câu hỏi.</div>
        <div :id="`question-card-${index}`" class="mono-card mb-6" v-for="(q, index) in questions" :key="q.id">
          <div class="card-body">
            <h3 class="question-text">Câu {{ (index as number) + 1 }}: {{ q.text }}</h3>
            <div class="options-grid">
              <label v-for="(opt, optIndex) in q.options" :key="optIndex" class="option-label">
                <input type="radio" :name="`q_${q.id}`" :value="optIndex" v-model="answers[q.id]" class="radio-input" />
                <span class="option-box"><strong>{{ String.fromCharCode(65 + Number(optIndex)) }}.</strong> {{ opt }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar câu hỏi nhanh (bên phải) -->
      <div class="exam-navigation-sidebar">
        <div class="nav-sidebar-title">Danh sách câu hỏi</div>
        <div class="nav-sidebar-grid">
          <button 
            v-for="(q, index) in questions" 
            :key="q.id" 
            class="nav-sidebar-btn"
            :class="{ 'answered': answers[q.id] !== undefined }"
            @click="scrollToQuestion(index)"
          >
            {{ index + 1 }}
          </button>
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
        Đóng và Trở về danh sách bài thi
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

  <!-- MODAL XEM LẠI BÀI THI CHI TIẾT -->
  <Transition name="fade">
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
      <div class="review-modal-card">
        <div class="review-modal-header">
          <div class="review-modal-title-section">
            <i class="pi pi-file-edit review-modal-icon"></i>
            <div>
              <h3>Xem lại bài làm</h3>
              <p v-if="selectedDetail">{{ selectedDetail.examTitle }}</p>
            </div>
          </div>
          <button class="review-close-btn" @click="closeDetailModal">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div v-if="loadingDetail" class="review-modal-loading">
          <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #6b7280;"></i>
          <p>Đang tải chi tiết bài làm...</p>
        </div>

        <div v-else-if="selectedDetail" class="review-modal-body">
          <!-- Summary bar -->
          <div class="review-summary-bar">
            <div class="review-summary-item">
              <span class="review-summary-label">Điểm số</span>
              <span class="review-summary-value" :class="selectedDetail.score >= 5 ? 'score-pass' : 'score-fail'">
                {{ selectedDetail.score }} / 10
              </span>
            </div>
            <div class="review-summary-item" v-if="selectedDetail.violations > 0">
              <span class="review-summary-label">Vi phạm</span>
              <span class="review-summary-value score-fail">{{ selectedDetail.violations }} lần</span>
            </div>
            <div class="review-summary-item" v-if="selectedDetail.submittedAt">
              <span class="review-summary-label">Nộp lúc</span>
              <span class="review-summary-value">{{ formatDateTime(selectedDetail.submittedAt) }}</span>
            </div>
          </div>

          <!-- Danh sách câu hỏi & đáp án -->
          <div class="review-questions-list">
            <div 
              v-for="(q, index) in selectedDetail.questions" 
              :key="index" 
              class="review-question-card"
            >
              <div class="review-question-header">
                <span class="review-question-number">Câu {{ index + 1 }}</span>
                <span 
                  v-if="selectedDetail.showAnswers"
                  class="review-question-status"
                  :class="getStudentAnswer(selectedDetail, index) === q.answer ? 'status-correct' : 'status-wrong'"
                >
                  <i :class="getStudentAnswer(selectedDetail, index) === q.answer ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
                  {{ getStudentAnswer(selectedDetail, index) === q.answer ? 'Đúng' : 'Sai' }}
                </span>
                <span 
                  v-else-if="getStudentAnswer(selectedDetail, index) === null" 
                  class="review-question-status status-skip"
                >
                  <i class="pi pi-minus-circle"></i> Bỏ qua
                </span>
              </div>
              <p class="review-question-text">{{ q.text }}</p>
              <div class="review-options-list">
                <div 
                  v-for="(opt, optIdx) in q.options" 
                  :key="optIdx"
                  class="review-option"
                  :class="{
                    'option-correct': selectedDetail.showAnswers && optIdx === q.answer,
                    'option-wrong': selectedDetail.showAnswers && getStudentAnswer(selectedDetail, index) === optIdx && optIdx !== q.answer,
                    'option-selected': getStudentAnswer(selectedDetail, index) === optIdx
                  }"
                >
                  <span class="review-option-letter">{{ String.fromCharCode(65 + optIdx) }}</span>
                  <span class="review-option-text">{{ opt }}</span>
                  <i v-if="selectedDetail.showAnswers && optIdx === q.answer" class="pi pi-check review-correct-icon"></i>
                  <i v-else-if="selectedDetail.showAnswers && getStudentAnswer(selectedDetail, index) === optIdx && optIdx !== q.answer" class="pi pi-times review-wrong-icon"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="review-modal-loading">
          <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #ef4444;"></i>
          <p>Không thể tải chi tiết bài làm.</p>
        </div>

        <div class="review-modal-footer">
          <button class="btn-submit" @click="closeDetailModal">Đóng</button>
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
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.text-center { text-align: center; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; font-size: 1.1rem; color: #111827; margin-bottom: 0.25rem; }
.text-sm { font-size: 0.85rem; }
.text-gray-900 { color: #111827; }
.text-gray-500 { color: #6b7280; }
.text-gray-700 { color: #374151; }
.text-green-600 { color: #166534; }
.text-green-500 { color: #22c55e; }
.text-red-500 { color: #ef4444; }
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
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; transition: all 0.3s ease; }
.mono-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
  border-color: #cbd5e1;
}
.bg-primary-gradient {
  background: linear-gradient(135deg, var(--lms-primary, #4f46e5) 0%, var(--lms-primary-hover, #4338ca) 100%) !important;
}
.text-white { color: #fff !important; }
.card-header { 
  padding: 1rem 1.5rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; background: #f9fafb; color: #111827;
  display: flex; justify-content: space-between; align-items: center;
}
.card-body { padding: 1.5rem; }

/* Card hoàn thành */
.card-completed {
  border-color: #bbf7d0;
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
}
.card-header-completed {
  background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%);
  border-bottom-color: #bbf7d0;
}
.completed-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #15803d;
  background: #dcfce7;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
}

/* Điểm số inline trên thẻ */
.score-inline {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.score-inline-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.submission-time-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.15rem;
}
.score-inline-label {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}
.score-inline-value {
  font-size: 1.1rem;
  font-weight: 700;
}
.score-inline-value small {
  font-size: 0.75rem;
  font-weight: 500;
  color: #9ca3af;
}
.score-pass { color: #15803d; }
.score-fail { color: #dc2626; }

/* Nút xem lại */
.btn-review {
  padding: 0.75rem 1.5rem;
  border: 1px solid #15803d;
  background: #f0fdf4;
  color: #15803d;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}
.btn-review:hover {
  background: #dcfce7;
  border-color: #166534;
  box-shadow: 0 4px 6px rgba(22, 101, 52, 0.1);
}

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

.exam-layout-container {
  display: flex;
  max-width: 68rem;
  margin: 2rem auto;
  width: 100%;
  padding: 0 1rem;
  gap: 2rem;
  flex-grow: 1;
  box-sizing: border-box;
}
.exam-questions-area {
  flex: 1;
}
.exam-navigation-sidebar {
  width: 240px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  height: fit-content;
  position: sticky;
  top: 5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  box-sizing: border-box;
}
.nav-sidebar-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #111827;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f3f4f6;
  text-align: center;
}
.nav-sidebar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 2px;
}
.nav-sidebar-btn {
  height: 38px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #4b5563;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.nav-sidebar-btn:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}
.nav-sidebar-btn.answered {
  background: var(--lms-primary, #4f46e5);
  color: #ffffff;
  border-color: var(--lms-primary, #4f46e5);
}

@media (max-width: 1024px) {
  .exam-layout-container {
    flex-direction: column-reverse;
    gap: 1.5rem;
  }
  .exam-navigation-sidebar {
    width: 100%;
    position: static;
  }
  .nav-sidebar-grid {
    grid-template-columns: repeat(10, 1fr);
  }
}

/* =============================================
   MODAL XEM LẠI BÀI THI CHI TIẾT
   ============================================= */
.review-modal-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
  width: 100%;
  max-width: 48rem;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.review-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f0fdf4 0%, #f9fafb 100%);
}

.review-modal-title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.review-modal-icon {
  font-size: 1.5rem;
  color: #15803d;
}

.review-modal-title-section h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.review-modal-title-section p {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0.15rem 0 0 0;
}

.review-close-btn {
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.review-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.review-modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: #6b7280;
}

.review-modal-body {
  overflow-y: auto;
  flex: 1;
  padding: 1.5rem;
}

/* Summary bar */
.review-summary-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.review-summary-item {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  flex: 1;
  min-width: 120px;
}
.review-summary-label {
  display: block;
  font-size: 0.7rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.review-summary-value {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

/* Questions list in review modal */
.review-questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.review-question-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1.25rem;
  background: #fff;
  transition: box-shadow 0.2s;
}
.review-question-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.review-question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.review-question-number {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--lms-primary, #4f46e5);
  background: var(--lms-primary-light, #e0e7ff);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}
.review-question-status {
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}
.status-correct {
  color: #15803d;
  background: #dcfce7;
}
.status-wrong {
  color: #dc2626;
  background: #fee2e2;
}
.status-skip {
  color: #9ca3af;
  background: #f3f4f6;
}
.review-question-text {
  font-size: 0.95rem;
  color: #111827;
  font-weight: 500;
  line-height: 1.5;
  margin: 0 0 0.75rem 0;
}

/* Options in review */
.review-options-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.review-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
  font-size: 0.9rem;
  color: #374151;
  transition: all 0.15s;
  position: relative;
}
.review-option.option-correct {
  border-color: #86efac;
  background: #f0fdf4;
  color: #15803d;
  font-weight: 500;
}
.review-option.option-wrong {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #dc2626;
  font-weight: 500;
}
.review-option.option-selected:not(.option-correct):not(.option-wrong) {
  border-color: #c7d2fe;
  background: #eef2ff;
}
.review-option-letter {
  font-weight: 700;
  font-size: 0.8rem;
  color: #6b7280;
  min-width: 1.25rem;
}
.option-correct .review-option-letter {
  color: #15803d;
}
.option-wrong .review-option-letter {
  color: #dc2626;
}
.review-option-text {
  flex: 1;
}
.review-correct-icon {
  color: #15803d;
  font-size: 1rem;
}
.review-wrong-icon {
  color: #dc2626;
  font-size: 1rem;
}

.review-modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .review-modal-card {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  .review-summary-bar {
    flex-direction: column;
  }
}
</style>
