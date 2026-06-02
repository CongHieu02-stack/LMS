<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiGet, apiPost } from '@/lib/api'

const router = useRouter()

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

const questions = ref<any[]>([])
// Trắc nghiệm: answers[questionId] = selectedOptionIndex
const answers = ref<Record<number, number>>({})
// Tự luận: essayAnswers[questionIndex] = text content
const essayAnswers = ref<Record<number, string>>({})
// File đính kèm tự luận: fileAnswers[questionIndex] = { url, name }
const fileAnswers = ref<Record<number, { url: string; name: string }>>({})
const fileUploading = ref<Record<number, boolean>>({})

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

onMounted(loadExams)

function selectExamToStart(exam: any) {
  selectedExam.value = exam
  questions.value = exam.questions || []
  timeLeft.value = (exam.duration_minutes || 60) * 60
}

// ==========================================
// ANTI-CHEAT LOGIC
// ==========================================
function handleVisibilityChange() {
  if (isExamStarted.value && !isExamFinished.value && document.visibilityState === 'hidden') {
    cheatWarnings.value++
    if (cheatWarnings.value >= 2) {
      alert('PHÁT HIỆN GIAN LẬN: Bạn đã thoát khỏi màn hình làm bài quá 2 lần. Bài thi sẽ tự động thu lại!')
      submitExam(true)
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
      submitExam(true)
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
  if (!selectedExam.value) return
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
      submitExam(false)
    }
  }, 1000)
}

async function handleFileUpload(questionIndex: number, event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  fileUploading.value[questionIndex] = true
  try {
    // Đọc file dưới dạng base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const res = await apiPost<{ success: boolean; fileUrl: string; fileName: string }>('/exam/upload', {
      fileName: file.name,
      fileData: base64
    })
    if (res.success && res.fileUrl) {
      fileAnswers.value[questionIndex] = { url: res.fileUrl, name: file.name }
    }
  } catch (err) {
    console.error('File upload error:', err)
    alert('Lỗi khi tải file lên. Vui lòng thử lại.')
  }
  fileUploading.value[questionIndex] = false
}

async function submitExam(isForced = false) {
  clearInterval(timerInterval)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)

  // Gộp tất cả câu trả lời (trắc nghiệm + tự luận + file)
  const answersList = questions.value.map((q: any, idx: number) => {
    if (q.type === 'essay') {
      return {
        question_id: idx,
        type: 'essay',
        essay_text: essayAnswers.value[idx] || '',
        file_url: fileAnswers.value[idx]?.url || null,
        file_name: fileAnswers.value[idx]?.name || null
      }
    } else {
      return {
        question_id: idx,
        type: 'multiple_choice',
        selected_option: answers.value[q.id] ?? answers.value[idx] ?? null
      }
    }
  })

  try {
    const res = await apiPost<{ success: boolean; data: any; score?: number }>('/exam/submit', {
      examId: selectedExam.value.id,
      examTitle: selectedExam.value.title,
      answers: answersList,
      isForced,
      violations: cheatWarnings.value
    })

    // Hiển thị điểm từ backend (đã chấm tự động cho trắc nghiệm)
    finalScore.value = res.score !== undefined && res.score !== null ? res.score : null

  } catch (err) {
    console.error('Submit error:', err)
  }

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
          <button class="btn-submit w-full mt-4" @click="selectExamToStart(e)">Vào phòng Lobby</button>
        </div>
      </div>
    </div>
  </div>

  <!-- LOBBY (Chưa bắt đầu) -->
  <div v-else-if="!isExamStarted" class="mono-wrapper lobby-view">
    <div class="mono-card max-w-lg mx-auto mt-10">
      <div class="card-header bg-gray-900 text-white">
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
      <button class="btn-outline" @click="submitExam(false)">Nộp bài sớm</button>
    </div>

    <!-- Nội dung câu hỏi -->
    <div class="exam-content">
      <div v-if="questions.length === 0" class="text-center py-10 text-gray-500">Bài thi chưa có nội dung câu hỏi.</div>
      <div class="mono-card mb-6" v-for="(q, index) in questions" :key="index">
        <div class="card-body">
          <h3 class="question-text">
            Câu {{ index + 1 }}
            <span v-if="q.type === 'essay'" class="badge-essay ml-2"><i class="pi pi-pencil mr-1"></i>Tự luận</span>
            : {{ q.text }}
          </h3>

          <!-- Trắc nghiệm -->
          <div v-if="!q.type || q.type === 'multiple_choice'" class="options-grid">
            <label v-for="(opt, optIndex) in q.options" :key="optIndex" class="option-label">
              <input type="radio" :name="`q_${index}`" :value="optIndex" v-model="answers[index]" class="radio-input" />
              <span class="option-box">{{ opt }}</span>
            </label>
          </div>

          <!-- Tự luận -->
          <div v-else-if="q.type === 'essay'" class="essay-section">
            <textarea
              v-model="essayAnswers[index]"
              class="essay-textarea"
              :placeholder="`Nhập câu trả lời của bạn cho câu ${index + 1}...`"
              rows="6"
            ></textarea>

            <!-- Upload file -->
            <div class="file-upload-area">
              <label class="file-upload-label">
                <i v-if="fileUploading[index]" class="pi pi-spin pi-spinner"></i>
                <i v-else class="pi pi-paperclip"></i>
                {{ fileUploading[index] ? 'Đang tải lên...' : 'Đính kèm file (PDF, Word, ảnh, tối đa 10MB)' }}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                  @change="handleFileUpload(index, $event)"
                  class="hidden-file-input"
                  :disabled="fileUploading[index]"
                />
              </label>
              <div v-if="fileAnswers[index]" class="file-uploaded">
                <i class="pi pi-check-circle text-green-600"></i>
                <a :href="fileAnswers[index].url" target="_blank" class="file-link">{{ fileAnswers[index].name }}</a>
              </div>
            </div>
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
      <p class="text-gray-500 mb-6">Bạn đã hoàn thành bài thi: {{ selectedExam.title }}.</p>

      <div v-if="finalScore !== null" class="score-display">
        <span class="score-label">Điểm số</span>
        <span class="score-value" :class="finalScore >= 5 ? 'text-green-600' : 'text-red-600'">
          {{ finalScore }} <small>/ 10</small>
        </span>
      </div>
      <div v-else class="pending-grade">
        <i class="pi pi-clock"></i>
        <p>Bài thi có câu tự luận — Điểm sẽ được cập nhật sau khi giảng viên chấm.</p>
      </div>

      <button class="btn-submit mx-auto mt-8" @click="closeExam">
        Đóng và Trở về trang chủ
      </button>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; background: #f3f4f6; min-height: 100vh; }

.page-header { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; } .breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #111827; }
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

/* Card */
.mono-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
.bg-gray-900 { background: #111827 !important; }
.text-white { color: #fff !important; }
.card-header { padding: 1rem 1.5rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; background: #f9fafb; color: #111827; }
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

/* Essay section */
.essay-section { display: flex; flex-direction: column; gap: 1rem; }
.essay-textarea {
  width: 100%; padding: 0.875rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px;
  font-family: inherit; font-size: 0.95rem; line-height: 1.6; color: #1f2937;
  resize: vertical; min-height: 140px; outline: none; transition: border-color 0.2s;
  box-sizing: border-box;
}
.essay-textarea:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.file-upload-area { display: flex; flex-direction: column; gap: 0.5rem; }
.file-upload-label {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1rem; border: 1.5px dashed #d1d5db; border-radius: 8px;
  background: #f9fafb; color: #6b7280; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;
}
.file-upload-label:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }
.hidden-file-input { display: none; }
.file-uploaded { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #166534; }
.file-link { color: #2563eb; text-decoration: underline; word-break: break-all; }
.badge-essay { display: inline-flex; align-items: center; font-size: 0.7rem; background: #fef9c3; color: #854d0e; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600; }
.ml-2 { margin-left: 0.5rem; }
.pending-grade { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 1.5rem; color: #92400e; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.pending-grade i { font-size: 2rem; color: #f59e0b; }
.pending-grade p { font-size: 0.9rem; line-height: 1.5; margin: 0; }

/* Result */
.result-icon { font-size: 4rem; }
.score-display { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: inline-block; }
.score-label { display: block; font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
.score-value { font-size: 3rem; font-weight: 600; line-height: 1; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
