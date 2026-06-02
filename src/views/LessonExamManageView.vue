<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import html2pdf from 'html2pdf.js'

const authStore = useAuthStore()

const classes = ref<any[]>([])
const selectedClass = ref<string>('')
const lessons = ref<any[]>([])
const exams = ref<any[]>([])
const loading = ref(true)
const msg = ref<string | null>(null)

// Forms
const lessonForm = ref({ title: '', youtubeUrl: '', description: '', docContent: '', type: 'video', sortOrder: 1 })
const examForm = ref({ title: '', durationMinutes: 60 })

// Question Builder State (hỗ trợ cả trắc nghiệm và tự luận)
const questions = ref<any[]>([])
const newQuestionText = ref('')
const newQuestionType = ref<'multiple_choice' | 'essay'>('multiple_choice')
const newOptions = ref(['', '', '', ''])
const newAnswer = ref(0) // 0 for A, 1 for B, 2 for C, 3 for D

function addQuestion() {
  if (!newQuestionText.value.trim()) {
    alert('Nội dung câu hỏi không được để trống!')
    return
  }
  if (newQuestionType.value === 'multiple_choice') {
    if (newOptions.value.some(o => !o.trim())) {
      alert('Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
      return
    }
    questions.value.push({
      type: 'multiple_choice',
      text: newQuestionText.value.trim(),
      options: [...newOptions.value],
      answer: newAnswer.value
    })
  } else {
    questions.value.push({
      type: 'essay',
      text: newQuestionText.value.trim()
    })
  }
  // Reset form
  newQuestionText.value = ''
  newOptions.value = ['', '', '', '']
  newAnswer.value = 0
  newQuestionType.value = 'multiple_choice'
}

// ============================================================
// GRADING / CHẤM ĐIỂM STATE
// ============================================================
const activeTab = ref<'content' | 'grading'>('content')
const submissions = ref<any[]>([])
const submissionsLoading = ref(false)

// Modal chấm điểm
const gradeModal = ref(false)
const gradeTarget = ref<any>(null) // bài nộp đang chấm
const gradeScore = ref<number | null>(null)
const gradeSubmitting = ref(false)
const gradeMsg = ref<string | null>(null)

async function loadSubmissions() {
  if (!selectedClass.value) return
  submissionsLoading.value = true
  try {
    const res = await apiGet<{success: boolean; data: any[]}>(`/exam-manage/submissions/${selectedClass.value}`)
    submissions.value = res.data || []
  } catch (err: any) {
    console.error('Load submissions error:', err)
    submissions.value = []
  }
  submissionsLoading.value = false
}

function openGradeModal(sub: any) {
  gradeTarget.value = sub
  gradeScore.value = sub.score ?? null
  gradeMsg.value = null
  gradeModal.value = true
}

function closeGradeModal() {
  gradeModal.value = false
  gradeTarget.value = null
  gradeScore.value = null
  gradeMsg.value = null
}

async function submitGrade() {
  if (gradeScore.value === null || gradeScore.value === undefined) {
    alert('Vui lòng nhập điểm.')
    return
  }
  if (gradeScore.value < 0 || gradeScore.value > 10) {
    alert('Điểm phải từ 0 đến 10.')
    return
  }
  gradeSubmitting.value = true
  gradeMsg.value = null
  try {
    await apiPost('/exam-manage/grade', {
      submissionId: gradeTarget.value.id,
      score: gradeScore.value
    })
    gradeMsg.value = 'Chấm điểm thành công!'
    // Cập nhật lại danh sách
    gradeTarget.value.score = gradeScore.value
    const idx = submissions.value.findIndex((s: any) => s.id === gradeTarget.value.id)
    if (idx !== -1) submissions.value[idx].score = gradeScore.value
    setTimeout(closeGradeModal, 800)
  } catch (err: any) {
    gradeMsg.value = `Lỗi: ${err.message}`
  }
  gradeSubmitting.value = false
}

function getAnswerText(question: any, answerObj: any): { student: string; correct: string; isCorrect: boolean } {
  if (!question || !answerObj) return { student: '—', correct: '—', isCorrect: false }
  if (question.type === 'essay') {
    return { student: answerObj.essay_text || '(Không có nội dung)', correct: '(Tự luận)', isCorrect: false }
  }
  const opts = question.options || []
  const labels = ['A', 'B', 'C', 'D']
  const studentLabel = answerObj.selected_option !== null && answerObj.selected_option !== undefined
    ? `${labels[answerObj.selected_option]}. ${opts[answerObj.selected_option] || ''}` : '—'
  const correctLabel = `${labels[question.answer]}. ${opts[question.answer] || ''}`
  return {
    student: studentLabel,
    correct: correctLabel,
    isCorrect: answerObj.selected_option === question.answer
  }
}

function removeQuestion(index: number) {
  questions.value.splice(index, 1)
}

// Lesson expanding
const expandedLessons = ref<string[]>([])
function toggleLessonExpand(id: string) {
  if (expandedLessons.value.includes(id)) {
    expandedLessons.value = expandedLessons.value.filter(x => x !== id)
  } else {
    expandedLessons.value.push(id)
  }
}

function getYouTubeId(url: string) {
  if (!url) return ''
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : url
}

function parseLessonContent(contentStr: string) {
  try {
    const parsed = JSON.parse(contentStr)
    return {
      type: parsed.type || (parsed.youtubeId ? 'video' : 'doc'),
      youtubeId: parsed.youtubeId || '',
      docContent: parsed.docContent || '',
      description: parsed.description || ''
    }
  } catch {
    return {
      type: 'video',
      youtubeId: '',
      docContent: '',
      description: contentStr || ''
    }
  }
}

const currentClassObj = computed(() => {
  return classes.value.find(c => c.id === selectedClass.value)
})

const exportingPDF = ref<string | null>(null)

function exportToPDF(lesson: any) {
  const element = document.getElementById(`pdf-content-${lesson.id}`)
  if (!element) return
  
  exportingPDF.value = lesson.id
  
  const className = currentClassObj.value?.name || ''
  const subjectName = currentClassObj.value?.subject?.name || ''
  const subjectCode = currentClassObj.value?.subject?.code || ''
  
  const opt = {
    margin:       0.5,
    filename:     `${lesson.title.replace(/\s+/g, '_')}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
  }

  html2pdf().from(element).set(opt).save().then(() => {
    exportingPDF.value = null
  }).catch((err: any) => {
    console.error('PDF export error:', err)
    exportingPDF.value = null
    alert('Có lỗi xảy ra khi xuất file PDF.')
  })
}

async function loadClasses() {
  loading.value = true
  try {
    const res = await apiGet<any>('/classes')
    const all = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])
    // Lọc lớp mà GV này dạy hoặc TBM quản lý
    classes.value = all.filter((c: any) => 
      (c.instructor?.id || c.instructor_id) === authStore.profile?.id || 
      (authStore.profile?.rank || 0) >= 70 // PĐT/HR/Admin thấy hết
    )
    if (classes.value.length > 0) {
      selectedClass.value = classes.value[0].id
      await loadClassContent()
    }
  } catch (err) {
    console.error(err)
  }
  loading.value = false
}

async function loadClassContent() {
  if (!selectedClass.value) return
  msg.value = null
  try {
    const [lesRes, exRes] = await Promise.all([
      apiGet<{success: boolean; data: any[]}>(`/lessons/class/${selectedClass.value}`),
      apiGet<{success: boolean; data: any[]}>(`/exam-manage/class/${selectedClass.value}`)
    ])
    lessons.value = lesRes.data || []
    exams.value = exRes.data || []
    // Nếu đang ở tab chấm điểm, tải lại submissions
    if (activeTab.value === 'grading') await loadSubmissions()
  } catch (err: any) {
    msg.value = err.message
  }
}

async function handleTabChange(tab: 'content' | 'grading') {
  activeTab.value = tab
  if (tab === 'grading' && submissions.value.length === 0) {
    await loadSubmissions()
  }
}

onMounted(loadClasses)

async function createLesson() {
  if (!selectedClass.value) return
  try {
    let contentPayload = ''
    if (lessonForm.value.type === 'video') {
      const ytId = getYouTubeId(lessonForm.value.youtubeUrl)
      contentPayload = JSON.stringify({
        type: 'video',
        youtubeId: ytId,
        description: lessonForm.value.description
      })
    } else {
      contentPayload = JSON.stringify({
        type: 'doc',
        docContent: lessonForm.value.docContent,
        description: lessonForm.value.description
      })
    }

    await apiPost('/lessons', {
      classId: selectedClass.value,
      title: lessonForm.value.title,
      content: contentPayload,
      sortOrder: lessonForm.value.sortOrder
    })
    
    lessonForm.value = { 
      title: '', 
      youtubeUrl: '', 
      description: '', 
      docContent: '', 
      type: 'video', 
      sortOrder: lessons.value.length + 2 
    }
    loadClassContent()
    msg.value = 'Tạo bài học thành công'
  } catch (err: any) { msg.value = err.message }
}

async function createExam() {
  if (!selectedClass.value) return
  if (questions.value.length === 0) {
    alert('Vui lòng thêm ít nhất 1 câu hỏi trước khi tạo bài kiểm tra!')
    return
  }
  try {
    await apiPost('/exam-manage', {
      classId: selectedClass.value,
      title: examForm.value.title,
      durationMinutes: examForm.value.durationMinutes,
      questions: questions.value
    })
    examForm.value = { title: '', durationMinutes: 60 }
    questions.value = []
    loadClassContent()
    const hasEssay = questions.value.some((q: any) => q.type === 'essay')
    msg.value = `Tạo bài kiểm tra thành công${hasEssay ? ' (có câu tự luận)' : ' (trắc nghiệm)'}`
  } catch (err: any) { msg.value = err.message }
}

async function toggleExamStatus(exam: any) {
  try {
    const newStatus = exam.status === 'published' ? 'draft' : 'published'
    await apiPut(`/exam-manage/${exam.id}`, { status: newStatus })
    loadClassContent()
  } catch (err: any) { msg.value = err.message }
}

async function deleteLesson(id: string) {
  if(!confirm('Xóa bài học này?')) return
  try {
    await apiDelete(`/lessons/${id}`)
    loadClassContent()
  } catch (err: any) { msg.value = err.message }
}

async function deleteExam(id: string) {
  if(!confirm('Xóa bài thi này?')) return
  try {
    await apiDelete(`/exam-manage/${id}`)
    loadClassContent()
  } catch (err: any) { msg.value = err.message }
}
</script>

<template>
  <div class="w">
    <div class="hdr">
      <div class="bc">Đào tạo & Khảo thí / <span>Soạn Bài & Thi</span></div>
      <h1 class="tt">Quản Lý Bài Học & Khảo Thí</h1>
      <div class="st">Giảng viên tạo nội dung bài giảng, bài kiểm tra và chấm điểm.</div>
    </div>

    <div v-if="msg" class="al"><i class="pi pi-info-circle"></i> {{ msg }}</div>
    <div v-if="loading" class="ld"><i class="pi pi-spin pi-spinner"></i></div>
    <div v-else-if="classes.length === 0" class="emp"><h3>Bạn chưa được phân công giảng dạy lớp nào.</h3></div>
    
    <template v-else>
      <div class="sel-card">
        <label>Chọn lớp học:</label>
        <select v-model="selectedClass" @change="loadClassContent" class="si">
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }} - {{ c.subject?.name }}</option>
        </select>
      </div>

      <!-- Tab Navigation -->
      <div class="tabs-nav">
        <button class="tab-btn" :class="{ 'tab-active': activeTab === 'content' }" @click="handleTabChange('content')">
          <i class="pi pi-book"></i> Bài giảng & Bài thi
        </button>
        <button class="tab-btn" :class="{ 'tab-active': activeTab === 'grading' }" @click="handleTabChange('grading')">
          <i class="pi pi-star"></i> Chấm điểm
          <span v-if="submissions.filter((s: any) => s.score === null).length > 0" class="tab-badge">
            {{ submissions.filter((s: any) => s.score === null).length }}
          </span>
        </button>
      </div>

      <!-- Tab: Nội dung bài giảng & bài thi -->
      <div v-if="activeTab === 'content'" class="split">
        <!-- Bài học -->
        <div class="flex-1">
          <div class="crd">
            <div class="ch"><span>Bài giảng ({{ lessons.length }})</span></div>
            <div class="cb">
              <!-- Form tạo bài giảng chuẩn Youtube Iframe -->
              <form @submit.prevent="createLesson" class="frm-col mb-6">
                <input v-model="lessonForm.title" class="inp" placeholder="Tên bài giảng mới (Ví dụ: Bài 1 - Nhập môn)..." required />
                
                <div class="type-selector mb-2">
                  <label class="selector-label">Loại bài học:</label>
                  <div class="radio-options">
                    <label class="radio-option">
                      <input type="radio" v-model="lessonForm.type" value="video" />
                      <span><i class="pi pi-video"></i> Video YouTube</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" v-model="lessonForm.type" value="doc" />
                      <span><i class="pi pi-file-pdf"></i> Tài liệu (Doc)</span>
                    </label>
                  </div>
                </div>

                <div v-if="lessonForm.type === 'video'">
                  <input v-model="lessonForm.youtubeUrl" class="inp w-full" placeholder="Link Video Youtube (Ví dụ: https://www.youtube.com/watch?v=...)..." />
                </div>
                
                <div v-else-if="lessonForm.type === 'doc'">
                  <textarea v-model="lessonForm.docContent" class="inp w-full html-editor" style="min-height:150px" placeholder="Nhập nội dung bài giảng (Hỗ trợ định dạng HTML cơ bản: <p>, <h3>, <strong>, <ul>, <li>, <blockquote>,...)"></textarea>
                  <div class="editor-hint">Gợi ý: Dùng các thẻ HTML để trình bày bài giảng đẹp mắt hơn khi xuất PDF.</div>
                </div>

                <textarea v-model="lessonForm.description" class="inp" style="min-height:70px" placeholder="Mô tả tóm tắt bài giảng / Ghi chú cho sinh viên..."></textarea>
                
                <button type="submit" class="btn"><i class="pi pi-plus"></i> Tạo bài giảng</button>
              </form>

              <!-- Danh sách bài giảng Accordion Premium -->
              <div class="lst">
                <div v-for="l in lessons" :key="l.id" class="lesson-card">
                  <div class="lesson-card-header" @click="toggleLessonExpand(l.id)">
                    <div class="lesson-card-title">
                      <i class="pi mr-2" :class="expandedLessons.includes(l.id) ? 'pi-chevron-down text-purple-600' : 'pi-chevron-right'"></i>
                      <span class="lesson-title-text">{{ l.title }}</span>
                      
                      <span v-if="parseLessonContent(l.content).type === 'video'" class="badge-video ml-2">
                        <i class="pi pi-video mr-1"></i>Video
                      </span>
                      <span v-else-if="parseLessonContent(l.content).type === 'doc'" class="badge-doc ml-2">
                        <i class="pi pi-file-pdf mr-1"></i>Tài liệu
                      </span>
                    </div>
                    <button @click.stop="deleteLesson(l.id)" class="btn-del"><i class="pi pi-trash"></i></button>
                  </div>

                  <!-- Expanded Body -->
                  <div v-if="expandedLessons.includes(l.id)" class="lesson-card-body">
                    <!-- YouTube video iframe container -->
                    <div v-if="parseLessonContent(l.content).type === 'video' && parseLessonContent(l.content).youtubeId" class="video-wrapper mb-3">
                      <iframe 
                        :src="'https://www.youtube.com/embed/' + parseLessonContent(l.content).youtubeId" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                      </iframe>
                    </div>

                    <!-- Document content area -->
                    <div v-if="parseLessonContent(l.content).type === 'doc'" class="instructor-doc-wrapper">
                      <div class="doc-actions mb-3">
                        <button @click="exportToPDF(l)" class="btn-pdf-download" :disabled="exportingPDF === l.id">
                          <i v-if="exportingPDF === l.id" class="pi pi-spin pi-spinner mr-1"></i>
                          <i v-else class="pi pi-file-pdf mr-1"></i>
                          Tải tài liệu PDF
                        </button>
                      </div>
                      
                      <!-- Vùng in PDF -->
                      <div :id="'pdf-content-' + l.id" class="pdf-print-area">
                        <div class="pdf-header-print">
                          <div class="pdf-header-row">
                            <span class="pdf-school">HỆ THỐNG QUẢN LÝ HỌC TẬP - LMS</span>
                            <span class="pdf-class">Lớp: {{ currentClassObj?.name }}</span>
                          </div>
                          <div class="pdf-subject">Môn học: {{ currentClassObj?.subject?.name }} ({{ currentClassObj?.subject?.code }})</div>
                          <hr class="pdf-divider" />
                        </div>
                        <h2 class="pdf-title">{{ l.title }}</h2>
                        <div class="pdf-body-content" v-html="parseLessonContent(l.content).docContent"></div>
                        <div v-if="parseLessonContent(l.content).description" class="pdf-desc-content">
                          <strong style="color: #374151; font-size: 0.9rem;">Ghi chú từ giảng viên:</strong>
                          <p style="margin-top: 0.25rem; font-style: italic; color: #4b5563; white-space: pre-wrap;">{{ parseLessonContent(l.content).description }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- Description for video lessons -->
                    <div v-if="parseLessonContent(l.content).type === 'video' && parseLessonContent(l.content).description" class="lesson-description">
                      {{ parseLessonContent(l.content).description }}
                    </div>
                    <div v-else-if="parseLessonContent(l.content).type === 'video' && !parseLessonContent(l.content).youtubeId" class="empty-desc">
                      Không có nội dung bài giảng video bổ sung.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bài kiểm tra -->
        <div class="flex-1">
          <div class="crd">
            <div class="ch"><span>Bài kiểm tra ({{ exams.length }})</span></div>
            <div class="cb">
              <form @submit.prevent="createExam" class="frm-col">
                <input v-model="examForm.title" class="inp" placeholder="Tên bài kiểm tra..." required />
                <div style="display:flex;gap:1rem;align-items:center">
                  <label>Thời gian (phút):</label>
                  <input v-model="examForm.durationMinutes" type="number" class="inp" style="width:80px" required />
                </div>

                <!-- BỘ TẠO CÂU HỎI (TRẮC NGHIỆM + TỰ LUẬN) -->
                <div class="question-builder-box">
                  <div class="qb-header">Soạn câu hỏi</div>

                  <!-- Chọn loại câu hỏi -->
                  <div class="qtype-selector">
                    <label class="qtype-option" :class="{ active: newQuestionType === 'multiple_choice' }">
                      <input type="radio" v-model="newQuestionType" value="multiple_choice" />
                      <i class="pi pi-list"></i> Trắc nghiệm
                    </label>
                    <label class="qtype-option" :class="{ active: newQuestionType === 'essay' }">
                      <input type="radio" v-model="newQuestionType" value="essay" />
                      <i class="pi pi-pencil"></i> Tự luận
                    </label>
                  </div>

                  <div class="frm-col-nested">
                    <textarea v-model="newQuestionText" class="inp" style="min-height:60px" placeholder="Nhập nội dung câu hỏi..."></textarea>

                    <!-- Chỉ hiện cho trắc nghiệm -->
                    <template v-if="newQuestionType === 'multiple_choice'">
                      <div class="options-grid">
                        <div class="opt-row">
                          <span class="opt-lbl">A:</span>
                          <input v-model="newOptions[0]" class="inp" placeholder="Lựa chọn A..." />
                        </div>
                        <div class="opt-row">
                          <span class="opt-lbl">B:</span>
                          <input v-model="newOptions[1]" class="inp" placeholder="Lựa chọn B..." />
                        </div>
                        <div class="opt-row">
                          <span class="opt-lbl">C:</span>
                          <input v-model="newOptions[2]" class="inp" placeholder="Lựa chọn C..." />
                        </div>
                        <div class="opt-row">
                          <span class="opt-lbl">D:</span>
                          <input v-model="newOptions[3]" class="inp" placeholder="Lựa chọn D..." />
                        </div>
                      </div>
                      <div class="ans-row">
                        <div class="flex-align">
                          <label class="mr-2">Đáp án đúng:</label>
                          <select v-model="newAnswer" class="si-sm">
                            <option :value="0">Đáp án A</option>
                            <option :value="1">Đáp án B</option>
                            <option :value="2">Đáp án C</option>
                            <option :value="3">Đáp án D</option>
                          </select>
                        </div>
                        <button type="button" @click="addQuestion" class="btn-add-q">
                          <i class="pi pi-plus"></i> Thêm câu hỏi
                        </button>
                      </div>
                    </template>

                    <!-- Tự luận: chỉ cần nút thêm -->
                    <template v-else>
                      <div class="essay-hint"><i class="pi pi-info-circle"></i> Câu tự luận cho phép sinh viên nhập văn bản và đính kèm file. Điểm sẽ được chấm thủ công.</div>
                      <button type="button" @click="addQuestion" class="btn-add-q btn-add-essay">
                        <i class="pi pi-plus"></i> Thêm câu tự luận
                      </button>
                    </template>
                  </div>
                </div>

                <!-- DANH SÁCH CÂU HỎI ĐÃ SOẠN -->
                <div v-if="questions.length > 0" class="added-questions-box">
                  <div class="qb-header">Danh sách câu hỏi đã thêm ({{ questions.length }})</div>
                  <div class="added-q-list">
                    <div v-for="(q, idx) in questions" :key="idx" class="added-q-item">
                      <div class="added-q-header">
                        <div style="display:flex;align-items:center;gap:0.5rem">
                          <span class="q-type-badge" :class="q.type === 'essay' ? 'badge-essay-sm' : 'badge-mc-sm'">
                            {{ q.type === 'essay' ? 'TL' : 'TN' }}
                          </span>
                          <strong class="q-title-text">Câu {{ idx + 1 }}: {{ q.text }}</strong>
                        </div>
                        <button type="button" @click="removeQuestion(idx)" class="btn-del-q"><i class="pi pi-trash"></i></button>
                      </div>
                      <div v-if="q.type !== 'essay'" class="added-q-opts">
                        <div class="opt-text" :class="{ 'correct-opt': q.answer === 0 }">A. {{ q.options[0] }}</div>
                        <div class="opt-text" :class="{ 'correct-opt': q.answer === 1 }">B. {{ q.options[1] }}</div>
                        <div class="opt-text" :class="{ 'correct-opt': q.answer === 2 }">C. {{ q.options[2] }}</div>
                        <div class="opt-text" :class="{ 'correct-opt': q.answer === 3 }">D. {{ q.options[3] }}</div>
                      </div>
                      <div v-else class="essay-q-hint">Sinh viên sẽ nhập câu trả lời & đính kèm file.</div>
                    </div>
                  </div>
                </div>

                <!-- Nút Tạo bài kiểm tra tổng -->
                <button type="submit" class="btn btn-block">
                  <i class="pi pi-check"></i> Hoàn tất & Tạo bài kiểm tra
                </button>
              </form>
              <div class="lst mt">
                <div v-for="e in exams" :key="e.id" class="li-exam">
                  <div class="ex-info">
                    <strong>{{ e.title }}</strong> ({{ e.duration_minutes }}p)
                    <span class="bdg" :class="e.status === 'published' ? 'bg-green' : 'bg-gray'">{{ e.status }}</span>
                  </div>
                  <div class="ex-acts">
                    <button @click="toggleExamStatus(e)" class="btn-sm">{{ e.status === 'published' ? 'Ẩn' : 'Publish' }}</button>
                    <button @click="deleteExam(e.id)" class="btn-del"><i class="pi pi-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Chấm điểm -->
      <div v-if="activeTab === 'grading'" class="grading-section">
        <div class="grading-header-row">
          <div>
            <h3 class="grading-title">Bài Nộp & Chấm Điểm</h3>
            <p class="grading-subtitle">Xem bài làm của sinh viên và nhập điểm cho từng bài.</p>
          </div>
          <button @click="loadSubmissions" class="btn-refresh" :disabled="submissionsLoading">
            <i class="pi" :class="submissionsLoading ? 'pi-spin pi-spinner' : 'pi-refresh'"></i>
            Tải lại
          </button>
        </div>

        <div v-if="submissionsLoading" class="ld"><i class="pi pi-spin pi-spinner"></i></div>

        <div v-else-if="submissions.length === 0" class="emp">
          <i class="pi pi-inbox" style="font-size:2.5rem;color:#d1d5db"></i>
          <p>Chưa có sinh viên nào nộp bài thi trong lớp này.</p>
        </div>

        <div v-else class="crd">
          <div class="ch">
            <span>{{ submissions.length }} bài nộp</span>
            <span class="pending-count" v-if="submissions.filter((s: any) => s.score === null).length > 0">
              {{ submissions.filter((s: any) => s.score === null).length }} chưa chấm
            </span>
          </div>
          <div class="table-wrap">
            <table class="grade-table">
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Bài thi</th>
                  <th>Thời gian nộp</th>
                  <th style="text-align:center">Vi phạm</th>
                  <th style="text-align:center">Điểm</th>
                  <th style="text-align:center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sub in submissions" :key="sub.id" class="grade-row">
                  <td>
                    <div class="student-info">
                      <strong>{{ sub.student?.full_name || 'N/A' }}</strong>
                      <small>{{ sub.student?.email || '' }}</small>
                    </div>
                  </td>
                  <td>{{ sub.exam_title }}</td>
                  <td>{{ new Date(sub.submitted_at).toLocaleString('vi-VN') }}</td>
                  <td style="text-align:center">
                    <span v-if="sub.violations > 0" class="violation-badge">{{ sub.violations }}</span>
                    <span v-else class="ok-badge">0</span>
                  </td>
                  <td style="text-align:center">
                    <span v-if="sub.score !== null" class="score-cell" :class="sub.score >= 5 ? 'score-pass' : 'score-fail'">
                      {{ Number(sub.score).toFixed(1) }}
                    </span>
                    <span v-else class="ungraded-badge">Chưa chấm</span>
                  </td>
                  <td style="text-align:center">
                    <button @click="openGradeModal(sub)" class="btn-grade">
                      <i class="pi pi-pencil"></i>
                      {{ sub.score !== null ? 'Sửa điểm' : 'Chấm điểm' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Chấm Điểm -->
    <div v-if="gradeModal" class="modal-overlay" @click.self="closeGradeModal">
      <div class="grade-modal">
        <div class="modal-hd">
          <span>Chấm điểm bài thi</span>
          <button class="btn-close-modal" @click="closeGradeModal"><i class="pi pi-times"></i></button>
        </div>
        <div class="modal-bd" v-if="gradeTarget">
          <div class="student-card">
            <i class="pi pi-user"></i>
            <div>
              <strong>{{ gradeTarget.student?.full_name }}</strong>
              <small>{{ gradeTarget.exam_title }}</small>
            </div>
          </div>

          <!-- Xem từng câu trả lời -->
          <div class="answers-preview">
            <div v-for="(ans, idx) in gradeTarget.answers" :key="idx" class="ans-item">
              <div class="ans-q">
                <span class="q-num">Câu {{ idx + 1 }}:</span>
                <span>{{ gradeTarget.questions?.[idx]?.text || 'Câu hỏi' }}</span>
              </div>
              <div v-if="gradeTarget.questions?.[idx]?.type === 'essay'" class="essay-ans">
                <div class="essay-text">{{ ans.essay_text || '(Không có câu trả lời)' }}</div>
                <a v-if="ans.file_url" :href="ans.file_url" target="_blank" class="file-dl-link">
                  <i class="pi pi-download"></i> {{ ans.file_name || 'Tải file đính kèm' }}
                </a>
              </div>
              <div v-else class="mc-ans">
                <div :class="getAnswerText(gradeTarget.questions?.[idx], ans).isCorrect ? 'ans-correct' : 'ans-wrong'">
                  <i :class="getAnswerText(gradeTarget.questions?.[idx], ans).isCorrect ? 'pi pi-check' : 'pi pi-times'"></i>
                  SV chọn: {{ getAnswerText(gradeTarget.questions?.[idx], ans).student }}
                </div>
                <div class="ans-key">Đáp án: {{ getAnswerText(gradeTarget.questions?.[idx], ans).correct }}</div>
              </div>
            </div>
          </div>

          <!-- Nhập điểm -->
          <div class="score-input-row">
            <label>Điểm (0 – 10):</label>
            <input v-model.number="gradeScore" type="number" min="0" max="10" step="0.1" class="score-input" placeholder="VD: 8.5" />
          </div>

          <div v-if="gradeMsg" class="grade-msg" :class="gradeMsg.startsWith('Lỗi') ? 'msg-err' : 'msg-ok'">{{ gradeMsg }}</div>
        </div>
        <div class="modal-ft">
          <button @click="closeGradeModal" class="btn-cancel-modal">Hủy</button>
          <button @click="submitGrade" class="btn-save-modal" :disabled="gradeSubmitting">
            <i v-if="gradeSubmitting" class="pi pi-spin pi-spinner"></i>
            <i v-else class="pi pi-check"></i>
            Lưu điểm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w { padding: 1.5rem 2rem; animation: fadeIn .3s ease-out; }
.hdr { margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
.bc { font-size: .8rem; color: #6b7280; margin-bottom: .5rem; } .bc span { color: #111827; font-weight: 600; }
.tt { font-size: 1.75rem; font-weight: 600; margin: 0 0 .5rem; color: #111827; }
.st { font-size: .875rem; color: #6b7280; }
.al { display: flex; align-items: center; gap: .75rem; padding: .75rem 1.25rem; border-radius: 8px; font-size: .875rem; margin-bottom: 1.5rem; background: #dbeafe; border: 1px solid #bfdbfe; color: #1e40af; }
.ld { display: flex; justify-content: center; padding: 4rem; font-size: 2rem; color: #6b7280; }
.emp { text-align: center; padding: 4rem; color: #6b7280; }
.sel-card { background: #fff; padding: 1rem 1.5rem; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; }
.sel-card label { font-weight: 600; color: #374151; }
.si { padding: .5rem 1rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: .95rem; min-width: 300px; outline: none; }
.split { display: flex; gap: 2rem; }
.flex-1 { flex: 1; }
.crd { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.05); overflow: hidden; }
.ch { background: #f9fafb; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; }
.cb { padding: 1.5rem; }
.frm { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
.frm-col { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; border-bottom: 1px dashed #e5e7eb; }
.inp { flex: 1; padding: .6rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-family: inherit; }
.btn { padding: .6rem 1.25rem; background: #111827; color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; }
.btn:hover { background: #374151; }
.lst { display: flex; flex-direction: column; gap: .75rem; }
.li { display: flex; justify-content: space-between; align-items: center; padding: .75rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
.li-exam { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.ex-info { display: flex; align-items: center; gap: .75rem; }
.bdg { font-size: .7rem; padding: .2rem .5rem; border-radius: 999px; font-weight: 600; color: #fff; }
.bg-green { background: #166534; } .bg-gray { background: #6b7280; }
.ex-acts { display: flex; gap: .5rem; }
.btn-sm { padding: .3rem .75rem; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; font-size: .8rem; }
.btn-sm:hover { background: #f3f4f6; }
.btn-del { color: #dc2626; background: none; border: none; cursor: pointer; padding: .2rem; }
.btn-del:hover { color: #991b1b; }
.mt { margin-top: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.lesson-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.2s ease; }
.lesson-card:hover { border-color: #d1d5db; }
.lesson-card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; background: #f9fafb; cursor: pointer; user-select: none; }
.lesson-card-title { display: flex; align-items: center; font-weight: 600; color: #111827; }
.lesson-title-text { font-size: 0.95rem; }
.badge-video { display: inline-flex; align-items: center; font-size: 0.7rem; background: #f3e8ff; color: #6b21a8; padding: 0.15rem 0.45rem; border-radius: 999px; font-weight: 600; }
.lesson-card-body { padding: 1.25rem; border-top: 1px solid #e5e7eb; background: #fff; }
.video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.07); border: 1px solid #e5e7eb; background: #000; }
.video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.lesson-description { font-size: 0.9rem; color: #4b5563; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.empty-desc { font-size: 0.85rem; color: #9ca3af; font-style: italic; }

@keyframes fadeIn { from{opacity:0}to{opacity:1} }
@media (max-width: 1024px) { .split { flex-direction: column; } }

/* ── Tab Navigation ── */
.tabs-nav { display: flex; gap: 0.25rem; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.5rem; }
.tab-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.875rem; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.2s; }
.tab-btn:hover { color: #111827; }
.tab-active { color: #7c3aed; border-bottom-color: #7c3aed; background: #faf5ff; }
.tab-badge { display: inline-flex; align-items: center; justify-content: center; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9999px; }

/* ── Question Type Selector ── */
.qtype-selector { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
.qtype-option { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #4b5563; transition: all 0.2s; }
.qtype-option.active { border-color: #7c3aed; background: #faf5ff; color: #7c3aed; font-weight: 600; }
.qtype-option input { display: none; }
.essay-hint { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.6rem 1rem; font-size: 0.82rem; color: #1e40af; display: flex; align-items: center; gap: 0.5rem; }
.btn-add-essay { background: #7c3aed !important; }
.btn-add-essay:hover { background: #6d28d9 !important; }

/* ── Question type badges ── */
.q-type-badge { font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; }
.badge-mc-sm { background: #dbeafe; color: #1e40af; }
.badge-essay-sm { background: #fef9c3; color: #854d0e; }
.essay-q-hint { font-size: 0.8rem; color: #6b7280; font-style: italic; margin-top: 0.25rem; }

/* ── Grading Section ── */
.grading-section { display: flex; flex-direction: column; gap: 1.5rem; }
.grading-header-row { display: flex; justify-content: space-between; align-items: flex-start; }
.grading-title { font-size: 1.1rem; font-weight: 700; color: #111827; margin: 0 0 0.25rem 0; }
.grading-subtitle { font-size: 0.85rem; color: #6b7280; margin: 0; }
.btn-refresh { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; font-size: 0.82rem; cursor: pointer; color: #374151; transition: all 0.2s; }
.btn-refresh:hover:not(:disabled) { background: #f3f4f6; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.pending-count { font-size: 0.75rem; background: #fef2f2; color: #dc2626; padding: 0.15rem 0.6rem; border-radius: 999px; font-weight: 600; border: 1px solid #fca5a5; }

/* ── Grade Table ── */
.table-wrap { overflow-x: auto; }
.grade-table { width: 100%; border-collapse: collapse; }
.grade-table th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 0.75rem 1rem; font-size: 0.77rem; font-weight: 600; color: #374151; text-align: left; text-transform: uppercase; }
.grade-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; vertical-align: middle; }
.grade-row:last-child td { border-bottom: none; }
.grade-row:hover { background: #faf5ff; }
.student-info { display: flex; flex-direction: column; gap: 0.1rem; }
.student-info strong { color: #111827; }
.student-info small { color: #9ca3af; font-size: 0.75rem; }
.violation-badge { background: #fee2e2; color: #dc2626; font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; }
.ok-badge { color: #6b7280; font-size: 0.82rem; }
.score-cell { font-size: 1.1rem; font-weight: 700; }
.score-pass { color: #166534; }
.score-fail { color: #dc2626; }
.ungraded-badge { font-size: 0.75rem; background: #fef9c3; color: #854d0e; padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 600; }
.btn-grade { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.75rem; background: #7c3aed; color: #fff; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-grade:hover { background: #6d28d9; }

/* ── Grade Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 1rem; animation: fadeIn 0.2s; }
.grade-modal { background: #fff; border-radius: 12px; width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); overflow: hidden; }
.modal-hd { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 700; font-size: 1rem; color: #111827; }
.btn-close-modal { background: none; border: none; color: #9ca3af; font-size: 1.1rem; cursor: pointer; }
.btn-close-modal:hover { color: #111827; }
.modal-bd { padding: 1.25rem 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; flex: 1; }
.modal-ft { padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; background: #f9fafb; display: flex; justify-content: flex-end; gap: 0.75rem; }
.student-card { display: flex; align-items: center; gap: 0.75rem; background: #f3f4f6; border-radius: 8px; padding: 0.75rem 1rem; }
.student-card i { font-size: 1.5rem; color: #7c3aed; }
.student-card strong { display: block; color: #111827; }
.student-card small { color: #6b7280; font-size: 0.8rem; }
.answers-preview { display: flex; flex-direction: column; gap: 0.75rem; max-height: 260px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem; background: #fafafa; }
.ans-item { border-bottom: 1px dashed #e5e7eb; padding-bottom: 0.5rem; }
.ans-item:last-child { border-bottom: none; }
.ans-q { font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.35rem; display: flex; gap: 0.4rem; }
.q-num { color: #7c3aed; }
.mc-ans { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; }
.ans-correct { color: #166534; display: flex; align-items: center; gap: 0.4rem; }
.ans-wrong { color: #dc2626; display: flex; align-items: center; gap: 0.4rem; }
.ans-key { color: #6b7280; font-size: 0.78rem; }
.essay-ans { display: flex; flex-direction: column; gap: 0.4rem; }
.essay-text { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #374151; white-space: pre-wrap; }
.file-dl-link { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: #2563eb; text-decoration: none; }
.file-dl-link:hover { text-decoration: underline; }
.score-input-row { display: flex; align-items: center; gap: 1rem; }
.score-input-row label { font-size: 0.875rem; font-weight: 600; color: #111827; white-space: nowrap; }
.score-input { width: 100px; padding: 0.5rem 0.75rem; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 1rem; font-weight: 600; outline: none; text-align: center; }
.score-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.grade-msg { padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.875rem; font-weight: 500; }
.msg-ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.msg-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.btn-cancel-modal { padding: 0.6rem 1.25rem; background: #fff; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-cancel-modal:hover { background: #f3f4f6; }
.btn-save-modal { display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.5rem; background: #7c3aed; color: #fff; border: 1px solid #7c3aed; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-save-modal:hover:not(:disabled) { background: #6d28d9; }
.btn-save-modal:disabled { opacity: 0.5; cursor: not-allowed; }
/* Interactive Question Builder Styles */
.question-builder-box { background: #fdfaf6; border: 1px solid #fed7aa; border-radius: 10px; padding: 1.25rem; margin-top: 0.5rem; text-align: left; }
.qb-header { font-weight: 700; font-size: 0.9rem; color: #c2410c; margin-bottom: 0.75rem; border-bottom: 1px solid #ffedd5; padding-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
.frm-col-nested { display: flex; flex-direction: column; gap: 0.75rem; }
.options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
.opt-row { display: flex; align-items: center; gap: 0.5rem; }
.opt-lbl { font-weight: 700; color: #ea580c; width: 15px; }
.ans-row { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px dashed #ffedd5; padding-top: 0.75rem; gap: 1rem; }
.flex-align { display: flex; align-items: center; }
.si-sm { padding: 0.4rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none; background: #fff; }
.btn-add-q { background: #ea580c; color: #fff; border: none; padding: 0.45rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.25rem; }
.btn-add-q:hover { background: #c2410c; }

/* Added Questions Box */
.added-questions-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; text-align: left; }
.added-questions-box .qb-header { color: #475569; border-bottom-color: #cbd5e1; }
.added-q-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto; }
.added-q-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; }
.added-q-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.q-title-text { font-size: 0.9rem; color: #1e293b; line-height: 1.4; }
.btn-del-q { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.95rem; padding: 0.2rem; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-del-q:hover { background: #fee2e2; color: #b91c1c; }
.added-q-opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #f1f5f9; }
.opt-text { font-size: 0.8rem; color: #64748b; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid transparent; }
.correct-opt { background: #dcfce7; color: #15803d; font-weight: 700; border: 1px solid #bbf7d0; }

.btn-block { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 600; }

/* Custom lesson type styles and PDF style */
.type-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.25rem;
}
.selector-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #4b5563;
}
.radio-options {
  display: flex;
  gap: 1.5rem;
}
.radio-option {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: #374151;
}
.radio-option input {
  accent-color: #7c3aed;
  cursor: pointer;
}
.html-editor {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  background: #f8fafc;
}
.editor-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: -0.25rem;
  font-style: italic;
}
.w-full {
  width: 100%;
  box-sizing: border-box;
}
.badge-doc {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: #fee2e2;
  color: #b91c1c;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}
.instructor-doc-wrapper {
  margin-top: 0.5rem;
}
.btn-pdf-download {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-pdf-download:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
}
.btn-pdf-download:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pdf-print-area {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.pdf-header-print {
  margin-bottom: 1.5rem;
  font-family: 'Inter', sans-serif;
}
.pdf-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
}
.pdf-school {
  text-transform: uppercase;
}
.pdf-subject {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
  margin-top: 0.25rem;
}
.pdf-divider {
  border: 0;
  border-top: 2px solid #374151;
  margin: 0.75rem 0 1.25rem 0;
}
.pdf-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 1rem;
  font-family: 'Inter', sans-serif;
  line-height: 1.3;
}
.pdf-body-content {
  font-size: 0.95rem;
  line-height: 1.7;
  color: #1f2937;
  font-family: 'Inter', sans-serif;
}
.pdf-body-content :deep(p) {
  margin-bottom: 1rem;
}
.pdf-body-content :deep(h3) {
  font-size: 1.15rem;
  font-weight: 600;
  color: #111827;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.pdf-body-content :deep(ul), .pdf-body-content :deep(ol) {
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}
.pdf-body-content :deep(li) {
  margin-bottom: 0.25rem;
}
.pdf-body-content :deep(strong) {
  font-weight: 700;
  color: #000;
}
.pdf-body-content :deep(blockquote) {
  border-left: 4px solid #7c3aed;
  background: #f9fafb;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  font-style: italic;
}
.pdf-desc-content {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px dashed #e5e7eb;
}
</style>
