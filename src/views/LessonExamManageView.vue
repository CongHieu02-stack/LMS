<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
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
const examForm = ref({ title: '', durationMinutes: 60, examType: 'midterm' })

// Modal state variables
const showCreateLessonModal = ref(false)
const showCreateExamModal = ref(false)
const showDetailLessonModal = ref(false)
const showDetailExamModal = ref(false)
const selectedLessonDetail = ref<any>(null)
const selectedExamDetail = ref<any>(null)

// Modal body HTML element references for auto-scrolling
const createExamModalBody = ref<HTMLElement | null>(null)
const editExamModalBody = ref<HTMLElement | null>(null)

function viewLessonDetail(lesson: any) {
  selectedLessonDetail.value = lesson
  showDetailLessonModal.value = true
}

function viewExamDetail(exam: any) {
  selectedExamDetail.value = exam
  showDetailExamModal.value = true
}

// Notification & Confirmation Modal States
const showNotificationModal = ref(false)
const notificationType = ref<'success' | 'error' | 'warning'>('success')
const notificationTitle = ref('')
const notificationMsg = ref('')
let notificationTimeoutId: any = null

function showToast(type: 'success' | 'error' | 'warning', title: string, message: string) {
  notificationType.value = type
  notificationTitle.value = title
  notificationMsg.value = message
  showNotificationModal.value = true

  if (notificationTimeoutId) {
    clearTimeout(notificationTimeoutId)
  }

  notificationTimeoutId = setTimeout(() => {
    showNotificationModal.value = false
  }, 3000)
}

// Delete Confirmation Modal States
const showConfirmDeleteModal = ref(false)
const deleteTargetType = ref<'lesson' | 'exam' | null>(null)
const deleteTargetId = ref<string | null>(null)
const confirmTitle = ref('')
const confirmMsg = ref('')

function triggerDeleteConfirm(type: 'lesson' | 'exam', id: string, title: string) {
  deleteTargetType.value = type
  deleteTargetId.value = id
  confirmTitle.value = 'Xác nhận xóa'
  confirmMsg.value = `Bạn có chắc chắn muốn xóa ${type === 'lesson' ? 'bài giảng' : 'bài kiểm tra'}: "${title}" không? Hành động này không thể hoàn tác.`
  showConfirmDeleteModal.value = true
}

async function executeDelete() {
  if (!deleteTargetType.value || !deleteTargetId.value) return
  showConfirmDeleteModal.value = false
  try {
    if (deleteTargetType.value === 'lesson') {
      await apiDelete(`/lessons/${deleteTargetId.value}`)
      showToast('success', 'Thành công', 'Đã xóa bài giảng thành công!')
    } else {
      await apiDelete(`/exam-manage/${deleteTargetId.value}`)
      showToast('success', 'Thành công', 'Đã xóa bài kiểm tra thành công!')
    }
    loadClassContent()
  } catch (err: any) {
    showToast('error', 'Lỗi', err.message || 'Có lỗi xảy ra khi xóa.')
  } finally {
    deleteTargetType.value = null
    deleteTargetId.value = null
  }
}

// Editing question in create modal state
const editingQuestionIndex = ref<number | null>(null)

function startEditQuestionInCreate(index: number) {
  editingQuestionIndex.value = index
  const q = questions.value[index]
  newQuestionText.value = q.text
  newOptions.value = [...q.options]
  newAnswer.value = Number(q.answer)
  
  if (createExamModalBody.value) {
    createExamModalBody.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function saveQuestionInCreate() {
  if (editingQuestionIndex.value === null) return
  if (!newQuestionText.value.trim()) {
    showToast('warning', 'Cảnh báo', 'Nội dung câu hỏi không được để trống!')
    return
  }
  if (newOptions.value.some(o => !o.trim())) {
    showToast('warning', 'Cảnh báo', 'Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
    return
  }
  questions.value[editingQuestionIndex.value] = {
    ...questions.value[editingQuestionIndex.value],
    text: newQuestionText.value.trim(),
    options: [...newOptions.value],
    answer: newAnswer.value
  }
  cancelEditQuestionInCreate()
}

function cancelEditQuestionInCreate() {
  editingQuestionIndex.value = null
  newQuestionText.value = ''
  newOptions.value = ['', '', '', '']
  newAnswer.value = 0
}

// Editing question in edit modal state
const editingQuestionIndexInEdit = ref<number | null>(null)

function startEditQuestionInEdit(index: number) {
  editingQuestionIndexInEdit.value = index
  const q = editExamQuestions.value[index]
  editNewQuestionText.value = q.text
  editNewOptions.value = [...q.options]
  editNewAnswer.value = Number(q.answer)

  if (editExamModalBody.value) {
    editExamModalBody.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function saveQuestionInEdit() {
  if (editingQuestionIndexInEdit.value === null) return
  if (!editNewQuestionText.value.trim()) {
    showToast('warning', 'Cảnh báo', 'Nội dung câu hỏi không được để trống!')
    return
  }
  if (editNewOptions.value.some(o => !o.trim())) {
    showToast('warning', 'Cảnh báo', 'Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
    return
  }
  editExamQuestions.value[editingQuestionIndexInEdit.value] = {
    ...editExamQuestions.value[editingQuestionIndexInEdit.value],
    text: editNewQuestionText.value.trim(),
    options: [...editNewOptions.value],
    answer: editNewAnswer.value
  }
  cancelEditQuestionInEdit()
}

function cancelEditQuestionInEdit() {
  editingQuestionIndexInEdit.value = null
  editNewQuestionText.value = ''
  editNewOptions.value = ['', '', '', '']
  editNewAnswer.value = 0
}

// Active tab state driven by route path
const route = useRoute()
const activeTab = ref<'lessons' | 'exams'>(route.path === '/exams' ? 'exams' : 'lessons')

watch(
  () => route.path,
  (newPath) => {
    activeTab.value = newPath === '/exams' ? 'exams' : 'lessons'
  }
)

// Multiple Choice Question Builder State
const questions = ref<any[]>([])
const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newAnswer = ref(0) // 0 for A, 1 for B, 2 for C, 3 for D

function addQuestion() {
  if (!newQuestionText.value.trim()) {
    showToast('warning', 'Cảnh báo', 'Nội dung câu hỏi không được để trống!')
    return
  }
  if (newOptions.value.some(o => !o.trim())) {
    showToast('warning', 'Cảnh báo', 'Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
    return
  }
  questions.value.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    text: newQuestionText.value.trim(),
    options: [...newOptions.value],
    answer: newAnswer.value
  })
  // reset question builder form
  newQuestionText.value = ''
  newOptions.value = ['', '', '', '']
  newAnswer.value = 0
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

// Exam expanding
const expandedExams = ref<string[]>([])
function toggleExamExpand(id: string) {
  if (expandedExams.value.includes(id)) {
    expandedExams.value = expandedExams.value.filter(x => x !== id)
  } else {
    expandedExams.value.push(id)
  }
}

function getYouTubeId(url: string) {
  if (!url) return ''
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : url
}

function parseLessonContent(contentStr: string) {
  try {
    const parsed = JSON.parse(contentStr)
    const type = parsed.type || (parsed.youtubeId ? 'video' : (parsed.fileUrl || parsed.pdfUrl || parsed.files ? 'file' : 'doc'))
    let files = parsed.files || []
    if (files.length === 0 && (parsed.fileUrl || parsed.pdfUrl)) {
      files = [{
        fileUrl: parsed.fileUrl || parsed.pdfUrl,
        fileExt: parsed.fileExt || 'pdf',
        fileName: parsed.fileName || 'Tài liệu'
      }]
    }
    return {
      type,
      youtubeId: parsed.youtubeId || '',
      docContent: parsed.docContent || '',
      fileUrl: parsed.fileUrl || parsed.pdfUrl || (files[0]?.fileUrl || ''),
      fileExt: parsed.fileExt || (files[0]?.fileExt || 'pdf'),
      fileName: parsed.fileName || (files[0]?.fileName || 'Tài liệu'),
      files,
      description: parsed.description || ''
    }
  } catch {
    return {
      type: 'video',
      youtubeId: '',
      docContent: '',
      fileUrl: '',
      fileExt: '',
      fileName: '',
      files: [],
      description: contentStr || ''
    }
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
    showToast('error', 'Lỗi', 'Có lỗi xảy ra khi xuất file PDF.')
  })
}

async function loadClasses() {
  loading.value = true
  try {
    const res = await apiGet<any>('/classes')
    const all = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])
    // Lọc lớp mà GV này dạy hoặc TBM quản lý
    classes.value = all
      .filter((c: any) => 
        (c.instructor?.id || c.instructor_id) === authStore.profile?.id || 
        (authStore.profile?.rank || 0) >= 70 // PĐT/HR/Admin thấy hết
      )
      .map((c: any) => {
        const subjectName = c.subject?.name || ''
        const subjectCode = c.subject?.code || ''
        const className = c.name || ''
        
        let displayName = className
        if (className && subjectName) {
          if (className.toLowerCase().includes(subjectName.toLowerCase())) {
            displayName = className
          } else {
            const parts = className.split(' - ')
            if (parts.length > 1) {
              const suffix = parts[parts.length - 1]
              if (suffix.toLowerCase().includes('lớp')) {
                displayName = `${subjectName} - ${suffix}`
              } else {
                displayName = `${subjectName} - ${className}`
              }
            } else {
              if (className.toUpperCase() === subjectCode.toUpperCase()) {
                displayName = subjectName
              } else {
                displayName = `${subjectName} - ${className}`
              }
            }
          }
        }
        return {
          ...c,
          name: displayName
        }
      })
    if (classes.value.length > 0) {
      selectedClass.value = classes.value[0].id
      await loadClassContent()
    }
  } catch (err: any) {
    console.error(err)
  }
  loading.value = false
}

async function loadClassContent() {
  if (!selectedClass.value) return
  try {
    const [lesRes, exRes] = await Promise.all([
      apiGet<{success: boolean; data: any[]}>(`/lessons/class/${selectedClass.value}`),
      apiGet<{success: boolean; data: any[]}>(`/exam-manage/class/${selectedClass.value}`)
    ])
    lessons.value = lesRes.data || []
    exams.value = exRes.data || []
  } catch (err: any) {
    showToast('error', 'Lỗi tải dữ liệu lớp học', err.message)
  }
}

onMounted(loadClasses)

const selectedFiles = ref<File[]>([])
const editSelectedFiles = ref<File[]>([])
const existingFiles = ref<any[]>([])

const selectedFile = ref<File | null>(null)
const editSelectedFile = ref<File | null>(null)
const existingFileUrl = ref('')
const existingFileName = ref('')
const existingFileExt = ref('')

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function handleFileChange(event: any) {
  const files = Array.from(event.target.files || []) as File[]
  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      showToast('warning', 'Cảnh báo', `Tệp tin "${file.name}" vượt quá dung lượng tối đa cho phép (100MB)!`)
      continue
    }
    selectedFiles.value.push(file)
  }
  event.target.value = ''
}

function handleEditFileChange(event: any) {
  const files = Array.from(event.target.files || []) as File[]
  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      showToast('warning', 'Cảnh báo', `Tệp tin "${file.name}" vượt quá dung lượng tối đa cho phép (100MB)!`)
      continue
    }
    editSelectedFiles.value.push(file)
  }
  event.target.value = ''
}

function removeSelectedFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

function removeEditSelectedFile(index: number) {
  editSelectedFiles.value.splice(index, 1)
}

function removeExistingFile(index: number) {
  existingFiles.value.splice(index, 1)
}

async function createLesson() {
  if (!selectedClass.value) return
  try {
    let contentPayload = ''
    if (lessonForm.value.type === 'video') {
      const url = (lessonForm.value.youtubeUrl || '').trim()
      if (!url) {
        showToast('warning', 'Cảnh báo', 'Vui lòng nhập link video YouTube!')
        return
      }
      const ytId = getYouTubeId(url)
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
      const isValid = url.match(regExp) && ytId && ytId.length === 11
      if (!isValid) {
        showToast('warning', 'Cảnh báo', 'Link video YouTube không hợp lệ! Vui lòng nhập đúng định dạng link xem video (Ví dụ: https://www.youtube.com/watch?v=...)')
        return
      }
      contentPayload = JSON.stringify({
        type: 'video',
        youtubeId: ytId,
        description: lessonForm.value.description
      })
    } else if (lessonForm.value.type === 'doc') {
      contentPayload = JSON.stringify({
        type: 'doc',
        docContent: lessonForm.value.docContent,
        description: lessonForm.value.description
      })
    } else if (lessonForm.value.type === 'file') {
      if (selectedFiles.value.length === 0) {
        showToast('warning', 'Cảnh báo', 'Vui lòng chọn ít nhất một tệp tin để tải lên!')
        return
      }
      const formData = new FormData()
      selectedFiles.value.forEach(file => {
        formData.append('files', file)
      })
      
      const uploadRes = await apiPost<{ success: boolean; files: any[] }>('/lessons/upload', formData)
      
      if (uploadRes.success) {
        contentPayload = JSON.stringify({
          type: 'file',
          files: uploadRes.files,
          description: lessonForm.value.description
        })
      } else {
        throw new Error('Tải lên tệp tin thất bại.')
      }
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
    selectedFiles.value = []
    loadClassContent()
    showCreateLessonModal.value = false
    showToast('success', 'Thành công', 'Tạo bài học thành công!')
  } catch (err: any) { showToast('error', 'Lỗi', err.message) }
}

async function createExam() {
  if (!selectedClass.value) return
  if (questions.value.length === 0) {
    showToast('warning', 'Cảnh báo', 'Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm trước khi tạo bài kiểm tra!')
    return
  }
  try {
    await apiPost('/exam-manage', {
      classId: selectedClass.value,
      title: examForm.value.title,
      durationMinutes: examForm.value.durationMinutes,
      examType: examForm.value.examType,
      questions: questions.value
    })
    examForm.value = { title: '', durationMinutes: 60, examType: 'other' }
    questions.value = []
    editingQuestionIndex.value = null
    loadClassContent()
    showCreateExamModal.value = false
    showToast('success', 'Thành công', 'Tạo bài kiểm tra trắc nghiệm thành công!')
  } catch (err: any) { showToast('error', 'Lỗi', err.message) }
}

async function toggleExamStatus(exam: any) {
  try {
    const newStatus = exam.status === 'published' ? 'draft' : 'published'
    await apiPut(`/exam-manage/${exam.id}`, { status: newStatus })
    loadClassContent()
    showToast('success', 'Thành công', newStatus === 'published' ? 'Đã phát hành bài kiểm tra!' : 'Đã ẩn bài kiểm tra!')
  } catch (err: any) { showToast('error', 'Lỗi', err.message) }
}

function deleteLesson(lesson: any) {
  triggerDeleteConfirm('lesson', lesson.id, lesson.title)
}

function deleteExam(exam: any) {
  triggerDeleteConfirm('exam', exam.id, exam.title)
}

// ─── CHỈNH SỬA BÀI GIẢNG ───
const showEditLessonModal = ref(false)
const editingLessonId = ref<string | null>(null)
const editLessonForm = ref({
  title: '',
  type: 'video',
  youtubeUrl: '',
  docContent: '',
  description: '',
  sortOrder: 1
})

function startEditLesson(lesson: any) {
  editingLessonId.value = lesson.id
  const content = parseLessonContent(lesson.content)
  editLessonForm.value = {
    title: lesson.title,
    type: content.type,
    youtubeUrl: content.type === 'video' && content.youtubeId ? 'https://www.youtube.com/watch?v=' + content.youtubeId : '',
    docContent: content.type === 'doc' ? content.docContent : '',
    description: content.description || '',
    sortOrder: lesson.sort_order || lesson.sortOrder || 1
  }
  existingFiles.value = [...(content.files || [])]
  editSelectedFiles.value = []
  showEditLessonModal.value = true
}

async function saveEditLesson() {
  if (!editingLessonId.value) return
  try {
    let contentPayload = ''
    if (editLessonForm.value.type === 'video') {
      const url = (editLessonForm.value.youtubeUrl || '').trim()
      if (!url) {
        showToast('warning', 'Cảnh báo', 'Vui lòng nhập link video YouTube!')
        return
      }
      const ytId = getYouTubeId(url)
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
      const isValid = url.match(regExp) && ytId && ytId.length === 11
      if (!isValid) {
        showToast('warning', 'Cảnh báo', 'Link video YouTube không hợp lệ! Vui lòng nhập đúng định dạng link xem video (Ví dụ: https://www.youtube.com/watch?v=...)')
        return
      }
      contentPayload = JSON.stringify({
        type: 'video',
        youtubeId: ytId,
        description: editLessonForm.value.description
      })
    } else if (editLessonForm.value.type === 'doc') {
      contentPayload = JSON.stringify({
        type: 'doc',
        docContent: editLessonForm.value.docContent,
        description: editLessonForm.value.description
      })
    } else if (editLessonForm.value.type === 'file') {
      let filesPayload = [...existingFiles.value]
      
      if (editSelectedFiles.value.length > 0) {
        const formData = new FormData()
        editSelectedFiles.value.forEach(file => {
          formData.append('files', file)
        })
        const uploadRes = await apiPost<{ success: boolean; files: any[] }>('/lessons/upload', formData)
        
        if (uploadRes.success) {
          filesPayload = [...filesPayload, ...uploadRes.files]
        } else {
          throw new Error('Tải lên tệp tin thất bại.')
        }
      }
      
      if (filesPayload.length === 0) {
        showToast('warning', 'Cảnh báo', 'Vui lòng tải lên ít nhất một tệp tin!')
        return
      }
      
      contentPayload = JSON.stringify({
        type: 'file',
        files: filesPayload,
        description: editLessonForm.value.description
      })
    }

    await apiPut(`/lessons/${editingLessonId.value}`, {
      title: editLessonForm.value.title,
      content: contentPayload,
      sort_order: editLessonForm.value.sortOrder
    })

    showEditLessonModal.value = false
    editingLessonId.value = null
    editSelectedFiles.value = []
    existingFiles.value = []
    loadClassContent()
    showToast('success', 'Thành công', 'Cập nhật bài giảng thành công!')
  } catch (err: any) {
    showToast('error', 'Lỗi', err.message)
  }
}

// ─── CHỈNH SỬA BÀI KIỂM TRA ───
const showEditExamModal = ref(false)
const editingExamId = ref<string | null>(null)
const editExamForm = ref({
  title: '',
  durationMinutes: 60,
  examType: 'midterm'
})
const editExamQuestions = ref<any[]>([])

// Form thêm câu hỏi trong modal sửa
const editNewQuestionText = ref('')
const editNewOptions = ref(['', '', '', ''])
const editNewAnswer = ref(0)

function startEditExam(exam: any) {
  editingExamId.value = exam.id
  editExamForm.value = {
    title: exam.title,
    durationMinutes: exam.duration_minutes || exam.durationMinutes || 60,
    examType: exam.exam_type || exam.examType || 'midterm'
  }
  // Deep copy questions
  editExamQuestions.value = (exam.questions || []).map((q: any) => ({
    id: q.id || Date.now() + Math.floor(Math.random() * 1000),
    text: q.text,
    options: [...q.options],
    answer: q.answer
  }))
  showEditExamModal.value = true
}

function addQuestionToEditExam() {
  if (!editNewQuestionText.value.trim()) {
    showToast('warning', 'Cảnh báo', 'Nội dung câu hỏi không được để trống!')
    return
  }
  if (editNewOptions.value.some(o => !o.trim())) {
    showToast('warning', 'Cảnh báo', 'Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
    return
  }
  editExamQuestions.value.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    text: editNewQuestionText.value.trim(),
    options: [...editNewOptions.value],
    answer: editNewAnswer.value
  })
  // reset form
  editNewQuestionText.value = ''
  editNewOptions.value = ['', '', '', '']
  editNewAnswer.value = 0
}

function removeQuestionFromEditExam(index: number) {
  editExamQuestions.value.splice(index, 1)
}

async function saveEditExam() {
  if (!editingExamId.value) return
  if (editExamQuestions.value.length === 0) {
    showToast('warning', 'Cảnh báo', 'Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm!')
    return
  }
  try {
    await apiPut(`/exam-manage/${editingExamId.value}`, {
      title: editExamForm.value.title,
      duration_minutes: editExamForm.value.durationMinutes,
      examType: editExamForm.value.examType,
      questions: editExamQuestions.value
    })
    showEditExamModal.value = false
    editingExamId.value = null
    editingQuestionIndexInEdit.value = null
    loadClassContent()
    showToast('success', 'Thành công', 'Cập nhật bài kiểm tra thành công!')
  } catch (err: any) {
    showToast('error', 'Lỗi', err.message)
  }
}
</script>

<template>
  <div class="w">
    <div class="hdr">
      <div class="bc">Đào tạo & Khảo thí / <span>{{ activeTab === 'lessons' ? 'Bài học' : 'Bài kiểm tra' }}</span></div>
      <h1 class="tt">{{ activeTab === 'lessons' ? 'Quản Lý Bài Học' : 'Quản Lý Khảo Thí' }}</h1>
      <div class="st">
        {{ activeTab === 'lessons' ? 'Giảng viên tạo nội dung bài giảng cho lớp.' : 'Giảng viên cấu hình bài kiểm tra cho lớp.' }}
      </div>
    </div>

    <div v-if="loading" class="ld"><i class="pi pi-spin pi-spinner"></i></div>
    <div v-else-if="classes.length === 0" class="emp"><h3>Bạn chưa được phân công giảng dạy lớp nào.</h3></div>
    
    <template v-else>
      <div class="sel-card">
        <label>Chọn lớp học:</label>
        <select v-model="selectedClass" @change="loadClassContent" class="si">
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="tabs-container">
        <!-- Tab 1: Bài học / Bài giảng -->
        <div v-if="activeTab === 'lessons'" class="tab-pane">
          <div class="crd">
            <div class="ch">
              <span>Bài giảng ({{ lessons.length }})</span>
              <button @click="showCreateLessonModal = true" class="btn-create-header">
                <i class="pi pi-plus"></i> Tạo bài giảng
              </button>
            </div>
            <div class="cb">
              <!-- Danh sách bài giảng tĩnh -->
              <div v-if="lessons.length === 0" class="empty-desc" style="text-align:center; padding: 2rem 0;">
                Chưa có bài giảng nào trong lớp này. Hãy bấm "+ Tạo bài giảng" để bắt đầu.
              </div>
              <div v-else class="lst">
                <div v-for="l in lessons" :key="l.id" class="lesson-card-static">
                  <div class="lesson-card-header-static">
                    <div class="lesson-card-title">
                      <span class="lesson-title-text">{{ l.title }}</span>
                      
                      <span v-if="parseLessonContent(l.content).type === 'video'" class="badge-video ml-2">
                        <i class="pi pi-video mr-1"></i>Video
                      </span>
                      <span v-else-if="parseLessonContent(l.content).type === 'doc'" class="badge-doc ml-2">
                        <i class="pi pi-file mr-1"></i>Tài liệu (HTML)
                      </span>
                      <span v-else-if="parseLessonContent(l.content).type === 'file'" class="ml-2" :class="parseLessonContent(l.content).fileExt === 'docx' ? 'badge-word' : 'badge-pdf'">
                        <i :class="parseLessonContent(l.content).fileExt === 'docx' ? 'pi pi-file-word mr-1' : 'pi pi-file-pdf mr-1'"></i>{{ parseLessonContent(l.content).fileExt === 'docx' ? 'Word' : 'PDF' }}
                      </span>
                    </div>
                    <div class="lesson-actions">
                      <button @click="viewLessonDetail(l)" class="btn-view-inline mr-2" title="Xem chi tiết"><i class="pi pi-eye"></i></button>
                      <button @click="startEditLesson(l)" class="btn-edit-inline mr-2" title="Chỉnh sửa bài giảng"><i class="pi pi-pencil"></i></button>
                      <button @click="deleteLesson(l)" class="btn-del" title="Xóa bài giảng"><i class="pi pi-trash"></i></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Bài kiểm tra -->
        <div v-if="activeTab === 'exams'" class="tab-pane">
          <div class="crd">
            <div class="ch">
              <span>Bài kiểm tra ({{ exams.length }})</span>
              <button @click="showCreateExamModal = true" class="btn-create-header">
                <i class="pi pi-plus"></i> Tạo bài kiểm tra
              </button>
            </div>
            <div class="cb">
              <!-- DANH SÁCH BÀI THI TĨNH -->
              <div v-if="exams.length === 0" class="empty-desc" style="text-align:center; padding: 2rem 0;">
                Chưa có bài kiểm tra nào trong lớp này. Hãy bấm "+ Tạo bài kiểm tra" để bắt đầu.
              </div>
              <div v-else class="lst">
                <div v-for="e in exams" :key="e.id" class="exam-card-item-static">
                  <div class="exam-card-header-static">
                    <div class="exam-card-title">
                      <span class="exam-title-text">{{ e.title }}</span>
                      <span class="badge-duration ml-2">
                        <i class="pi pi-clock mr-1"></i>{{ e.duration_minutes }} phút
                      </span>
                      <span class="badge-exam-type ml-2" :class="'badge-' + (e.exam_type || 'other')">
                        <i class="pi pi-file mr-1"></i>{{ getExamTypeLabel(e.exam_type) }}
                      </span>
                    </div>
                    <div class="ex-acts">
                      <button @click="viewExamDetail(e)" class="btn-view-inline mx-2" title="Xem chi tiết">
                        <i class="pi pi-eye"></i>
                      </button>
                      <button @click="startEditExam(e)" class="btn-edit-inline mr-2" title="Chỉnh sửa bài thi">
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button @click="deleteExam(e)" class="btn-del" title="Xóa bài thi"><i class="pi pi-trash"></i></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Modal Tạo Bài Giảng -->
  <div v-if="showCreateLessonModal" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-lg">
      <div class="custom-modal-header">
        <i class="pi pi-plus custom-modal-icon"></i>
        <h3>Tạo Bài Giảng Mới</h3>
      </div>
      <div class="custom-modal-body">
        <form @submit.prevent="createLesson" class="frm-col">
          <input v-model="lessonForm.title" class="inp" placeholder="Tên bài giảng mới (Ví dụ: Bài 1 - Nhập môn)..." required />
          
          <div class="type-selector mb-2">
            <label class="selector-label">Loại bài học:</label>
            <div class="radio-options">
              <label class="radio-option">
                <input type="radio" v-model="lessonForm.type" value="video" />
                <span><i class="pi pi-video"></i> Video YouTube</span>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="lessonForm.type" value="file" />
                <span><i class="pi pi-upload"></i> Tài liệu (PDF, Word)</span>
              </label>
            </div>
          </div>

          <div v-if="lessonForm.type === 'video'">
            <input v-model="lessonForm.youtubeUrl" class="inp w-full" placeholder="Link Video Youtube (Ví dụ: https://www.youtube.com/watch?v=...)..." />
          </div>

          <div v-else-if="lessonForm.type === 'file'" class="frm-col">
            <div class="file-upload-zone" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; position: relative;">
              <input type="file" @change="handleFileChange" accept=".pdf,.docx" multiple style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
              <div class="file-upload-prompt" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: #64748b;">
                <i class="pi pi-upload" style="font-size: 1.5rem; color: #7c3aed;"></i>
                <span style="font-size: 0.9rem; font-weight: 500;">Chọn một hoặc nhiều tệp PDF hoặc Word (.docx)</span>
                <span style="font-size: 0.75rem; color: #94a3b8;">Dung lượng tối đa 100MB mỗi tệp</span>
              </div>
            </div>
            
            <!-- Danh sách tệp đã chọn -->
            <div v-if="selectedFiles.length > 0" class="selected-files-list" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">Các tệp đã chọn ({{ selectedFiles.length }}):</div>
              <div v-for="(file, idx) in selectedFiles" :key="idx" class="file-uploaded-info" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <i :class="file.name.endsWith('.docx') ? 'pi pi-file-word' : 'pi pi-file-pdf'" :style="file.name.endsWith('.docx') ? 'font-size: 1.25rem; color: #2563eb;' : 'font-size: 1.25rem; color: #ef4444;'"></i>
                  <div style="text-align: left;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ file.name }}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">{{ formatFileSize(file.size) }}</div>
                  </div>
                </div>
                <button type="button" @click.stop="removeSelectedFile(idx)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.25rem;"><i class="pi pi-times"></i></button>
              </div>
            </div>
          </div>

          <textarea v-model="lessonForm.description" class="inp" style="min-height:70px" placeholder="Mô tả tóm tắt bài giảng / Ghi chú cho sinh viên..."></textarea>
          
          <div class="custom-modal-footer mt-4">
            <button type="button" class="btn-cancel" @click="showCreateLessonModal = false">Hủy bỏ</button>
            <button type="submit" class="btn"><i class="pi pi-plus"></i> Tạo bài giảng</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal Tạo Bài Kiểm Tra -->
  <div v-if="showCreateExamModal" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-xl">
      <div class="custom-modal-header">
        <i class="pi pi-plus custom-modal-icon"></i>
        <h3>Tạo Bài Kiểm Tra Mới</h3>
      </div>
      <div class="custom-modal-body modal-scrollable" ref="createExamModalBody">
        <form @submit.prevent="createExam" class="frm-col">
          <input v-model="examForm.title" class="inp" placeholder="Tên bài kiểm tra..." required />
          <div style="display:flex;gap:1rem;align-items:center">
            <label>Thời gian (phút):</label>
            <input v-model="examForm.durationMinutes" type="number" class="inp" style="width:80px" required />
          </div>
          <div style="display:flex;gap:1rem;align-items:center">
            <label>Loại bài thi:</label>
            <select v-model="examForm.examType" class="si">
              <option value="regular">Thường xuyên</option>
              <option value="midterm">Giữa kỳ</option>
              <option value="final">Cuối kỳ</option>
            </select>
          </div>

          <!-- BỘ TẠO CÂU HỎI TRẮC NGHIỆM TƯƠNG TÁC -->
          <div class="question-builder-box">
            <div class="qb-header">
              {{ editingQuestionIndex === null ? 'Soạn câu hỏi trắc nghiệm mới' : 'Chỉnh sửa câu hỏi trắc nghiệm' }}
            </div>
            
            <div class="frm-col-nested">
              <textarea v-model="newQuestionText" class="inp" style="min-height:60px" placeholder="Nhập câu hỏi..."></textarea>
              
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
                <div v-if="editingQuestionIndex === null">
                  <button type="button" @click="addQuestion" class="btn-add-q">
                    <i class="pi pi-plus"></i> Thêm câu hỏi
                  </button>
                </div>
                <div v-else style="display: flex; gap: 0.5rem;">
                  <button type="button" @click="cancelEditQuestionInCreate" class="btn-cancel-q-edit">
                    Hủy
                  </button>
                  <button type="button" @click="saveQuestionInCreate" class="btn-save-q-edit">
                    Cập nhật câu hỏi
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- DANH SÁCH CÂU HỎI ĐÃ SOẠN -->
          <div v-if="questions.length > 0" class="added-questions-box">
            <div class="qb-header">Danh sách câu hỏi đã thêm ({{ questions.length }})</div>
            <div class="added-q-list">
              <div v-for="(q, idx) in questions" :key="idx" class="added-q-item" :style="editingQuestionIndex === idx ? 'border-color: #7c3aed; background: #faf5ff;' : ''">
                <div class="added-q-header">
                  <strong class="q-title-text">Câu {{ idx + 1 }}: {{ q.text }}</strong>
                  <div>
                    <button type="button" @click="startEditQuestionInCreate(idx)" class="btn-edit-q-inline" title="Sửa câu hỏi"><i class="pi pi-pencil"></i></button>
                    <button type="button" @click="removeQuestion(idx)" class="btn-del-q" title="Xóa câu hỏi"><i class="pi pi-trash"></i></button>
                  </div>
                </div>
                <div class="added-q-opts">
                  <div class="opt-text" :class="{ 'correct-opt': q.answer === 0 }">A. {{ q.options[0] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': q.answer === 1 }">B. {{ q.options[1] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': q.answer === 2 }">C. {{ q.options[2] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': q.answer === 3 }">D. {{ q.options[3] }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="custom-modal-footer mt-4">
            <button type="button" class="btn-cancel" @click="showCreateExamModal = false; cancelEditQuestionInCreate();">Hủy bỏ</button>
            <button type="submit" class="btn"><i class="pi pi-check"></i> Hoàn tất & Tạo</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal Chi Tiết Bài Giảng -->
  <div v-if="showDetailLessonModal && selectedLessonDetail" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-xl">
      <div class="custom-modal-header">
        <i class="pi pi-info-circle custom-modal-icon"></i>
        <h3>Chi Tiết Bài Giảng: {{ selectedLessonDetail.title }}</h3>
      </div>
      <div class="custom-modal-body modal-scrollable">
        <!-- YouTube video iframe container -->
        <div v-if="parseLessonContent(selectedLessonDetail.content).type === 'video' && parseLessonContent(selectedLessonDetail.content).youtubeId" class="video-wrapper mb-3">
          <iframe 
            :src="'https://www.youtube.com/embed/' + parseLessonContent(selectedLessonDetail.content).youtubeId" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>

        <!-- Document content area -->
        <div v-if="parseLessonContent(selectedLessonDetail.content).type === 'doc'" class="instructor-doc-wrapper">
          <div class="doc-actions mb-3">
            <button @click="exportToPDF(selectedLessonDetail)" class="btn-pdf-download" :disabled="exportingPDF === selectedLessonDetail.id">
              <i v-if="exportingPDF === selectedLessonDetail.id" class="pi pi-spin pi-spinner mr-1"></i>
              <i v-else class="pi pi-file-pdf mr-1"></i>
              Tải tài liệu PDF
            </button>
          </div>
          
          <!-- Vùng in PDF -->
          <div :id="'pdf-content-' + selectedLessonDetail.id" class="pdf-print-area">
            <div class="pdf-header-print">
              <div class="pdf-header-row">
                <span class="pdf-school">HỆ THỐNG QUẢN LÝ HỌC TẬP - LMS</span>
                <span class="pdf-class">Lớp: {{ currentClassObj?.name }}</span>
              </div>
              <div class="pdf-subject">Môn học: {{ currentClassObj?.subject?.name }} ({{ currentClassObj?.subject?.code }})</div>
              <hr class="pdf-divider" />
            </div>
            <h2 class="pdf-title">{{ selectedLessonDetail.title }}</h2>
            <div class="pdf-body-content" v-html="parseLessonContent(selectedLessonDetail.content).docContent"></div>
            <div v-if="parseLessonContent(selectedLessonDetail.content).description" class="pdf-desc-content">
              <strong style="color: #374151; font-size: 0.9rem;">Ghi chú từ giảng viên:</strong>
              <p style="margin-top: 0.25rem; font-style: italic; color: #4b5563; white-space: pre-wrap;">{{ parseLessonContent(selectedLessonDetail.content).description }}</p>
            </div>
          </div>
        </div>

        <!-- Generic file content area (PDF & DOCX) -->
        <div v-if="parseLessonContent(selectedLessonDetail.content).type === 'file'" class="student-pdf-wrapper mb-3" style="width: 100%; display: flex; flex-direction: column; gap: 1.5rem;">
          <div v-for="(file, idx) in parseLessonContent(selectedLessonDetail.content).files" :key="idx" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; background: #fff;">
            <div style="font-size: 0.9rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              <span>Tài liệu {{ idx + 1 }}: {{ file.fileName }}</span>
              <a :href="file.fileUrl" target="_blank" class="btn-pdf-download text-center no-underline" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; background: #7c3aed; color: #fff; padding: 0.35rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem;">
                <i class="pi pi-download mr-1"></i> Tải về ({{ file.fileExt.toUpperCase() }})
              </a>
            </div>
            
            <!-- Show inline PDF viewer if PDF -->
            <div v-if="file.fileExt === 'pdf'" class="pdf-viewer-container" style="border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; height: 350px;">
              <iframe :src="file.fileUrl" class="pdf-iframe-viewer" style="width: 100%; height: 100%; border: 0;" frameborder="0"></iframe>
            </div>
            <!-- Show download card if DOCX -->
            <div v-else class="docx-download-card" style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; gap: 1rem; flex-wrap: wrap;">
              <div class="docx-info" style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 200px;">
                <i class="pi pi-file-word docx-icon" style="font-size: 2rem; color: #2563eb;"></i>
                <div class="docx-details" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <span class="docx-filename" style="font-weight: 600; color: #1e293b; font-size: 0.85rem;">{{ file.fileName || 'Tài liệu Word' }}</span>
                  <span class="docx-hint" style="font-size: 0.75rem; color: #64748b;">Tài liệu Word (.docx) cần được tải xuống để xem nội dung</span>
                </div>
              </div>
              <a :href="file.fileUrl" target="_blank" class="btn-download-docx" style="background: #2563eb; color: #fff; padding: 0.4rem 0.80rem; border-radius: 6px; font-weight: 600; font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center;">
                <i class="pi pi-download mr-1"></i> Tải xuống (.docx)
              </a>
            </div>
          </div>
        </div>

        <!-- Description for Video and File lessons -->
        <div v-if="['video', 'file'].includes(parseLessonContent(selectedLessonDetail.content).type) && parseLessonContent(selectedLessonDetail.content).description" class="lesson-description mt-3" style="margin-top: 1rem; background: #f1f5f9; padding: 1rem; border-radius: 10px; font-size: 0.85rem; color: #475569; line-height: 1.5; border-left: 4px solid #cbd5e1;">
          <strong style="color: #374151; font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">Mô tả / Ghi chú:</strong>
          {{ parseLessonContent(selectedLessonDetail.content).description }}
        </div>

        <!-- Description for video lessons -->
        <div v-if="parseLessonContent(selectedLessonDetail.content).type === 'video' && parseLessonContent(selectedLessonDetail.content).description" class="lesson-description mt-3">
          <strong style="color: #374151; font-size: 0.9rem;">Mô tả:</strong>
          <p style="margin-top: 0.25rem; white-space: pre-wrap;">{{ parseLessonContent(selectedLessonDetail.content).description }}</p>
        </div>
        <div v-else-if="parseLessonContent(selectedLessonDetail.content).type === 'video' && !parseLessonContent(selectedLessonDetail.content).youtubeId" class="empty-desc">
          Không có nội dung bài giảng video bổ sung.
        </div>
      </div>
      <div class="custom-modal-footer">
        <button type="button" class="btn-cancel" @click="showDetailLessonModal = false">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Modal Chi Tiết Bài Kiểm Tra -->
  <div v-if="showDetailExamModal && selectedExamDetail" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-xl">
      <div class="custom-modal-header">
        <i class="pi pi-info-circle custom-modal-icon"></i>
        <h3>Chi Tiết Bài Kiểm Tra: {{ selectedExamDetail.title }}</h3>
      </div>
      <div class="custom-modal-body modal-scrollable">
        <div style="margin-bottom: 1rem; display: flex; gap: 1.5rem;">
          <div><strong>Thời gian làm bài:</strong> {{ selectedExamDetail.duration_minutes || selectedExamDetail.durationMinutes }} phút</div>
          <div><strong>Số câu hỏi:</strong> {{ selectedExamDetail.questions?.length || 0 }} câu</div>
        </div>

        <div v-if="!selectedExamDetail.questions || selectedExamDetail.questions.length === 0" class="empty-questions">
          Bài thi chưa có câu hỏi nào.
        </div>
        <div v-else class="preview-q-list">
          <div v-for="(q, idx) in selectedExamDetail.questions" :key="idx" class="preview-q-item">
            <div class="preview-q-text">
              <strong>Câu {{ Number(idx) + 1 }}:</strong> {{ q.text }}
            </div>
            <div class="preview-q-opts">
              <div 
                v-for="(opt, oIdx) in q.options" 
                :key="oIdx" 
                class="preview-opt-text"
                :class="{ 'correct-opt': Number(q.answer) === Number(oIdx) }"
              >
                {{ String.fromCharCode(65 + Number(oIdx)) }}. {{ opt }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="custom-modal-footer">
        <button type="button" class="btn-cancel" @click="showDetailExamModal = false">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Modal Sửa Bài Giảng -->
  <div v-if="showEditLessonModal" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-lg">
      <div class="custom-modal-header">
        <i class="pi pi-pencil custom-modal-icon"></i>
        <h3>Chỉnh Sửa Bài Giảng</h3>
      </div>
      <div class="custom-modal-body">
        <form @submit.prevent="saveEditLesson" class="frm-col">
          <input v-model="editLessonForm.title" class="inp" placeholder="Tên bài giảng..." required />
          
          <div class="type-selector mb-2">
            <label class="selector-label">Loại bài học:</label>
            <div class="radio-options">
              <label class="radio-option">
                <input type="radio" v-model="editLessonForm.type" value="video" />
                <span><i class="pi pi-video"></i> Video YouTube</span>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="editLessonForm.type" value="file" />
                <span><i class="pi pi-upload"></i> Tài liệu (PDF, Word)</span>
              </label>
            </div>
          </div>

          <div v-if="editLessonForm.type === 'video'">
            <input v-model="editLessonForm.youtubeUrl" class="inp w-full" placeholder="Link Video Youtube..." />
          </div>

          <div v-else-if="editLessonForm.type === 'file'" class="frm-col">
            <div class="file-upload-zone" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; position: relative;">
              <input type="file" @change="handleEditFileChange" accept=".pdf,.docx" multiple style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
              <div class="file-upload-prompt" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: #64748b;">
                <i class="pi pi-upload" style="font-size: 1.5rem; color: #7c3aed;"></i>
                <span style="font-size: 0.9rem; font-weight: 500;">Chọn thêm tệp PDF hoặc Word (.docx) mới</span>
                <span style="font-size: 0.75rem; color: #94a3b8;">Dung lượng tối đa 100MB mỗi tệp</span>
              </div>
            </div>
            
            <!-- Danh sách tài liệu hiện có -->
            <div v-if="existingFiles.length > 0" class="existing-files-list" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">Tài liệu đã có ({{ existingFiles.length }}):</div>
              <div v-for="(file, idx) in existingFiles" :key="'exist-' + idx" class="file-uploaded-info" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <i :class="file.fileExt === 'docx' ? 'pi pi-file-word' : 'pi pi-file-pdf'" :style="file.fileExt === 'docx' ? 'font-size: 1.25rem; color: #2563eb;' : 'font-size: 1.25rem; color: #ef4444;'"></i>
                  <div style="text-align: left;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ file.fileName || 'Tài liệu' }}</div>
                    <div style="font-size: 0.75rem; color: #10b981; font-weight: 500;">Đã tải lên</div>
                  </div>
                </div>
                <button type="button" @click.stop="removeExistingFile(idx)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.25rem;" title="Xóa file này"><i class="pi pi-times"></i></button>
              </div>
            </div>

            <!-- Danh sách tệp mới chọn -->
            <div v-if="editSelectedFiles.length > 0" class="new-files-list" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">Tài liệu mới chọn ({{ editSelectedFiles.length }}):</div>
              <div v-for="(file, idx) in editSelectedFiles" :key="'new-' + idx" class="file-uploaded-info" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <i :class="file.name.endsWith('.docx') ? 'pi pi-file-word' : 'pi pi-file-pdf'" :style="file.name.endsWith('.docx') ? 'font-size: 1.25rem; color: #2563eb;' : 'font-size: 1.25rem; color: #ef4444;'"></i>
                  <div style="text-align: left;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: #166534; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ file.name }} (Chờ lưu)</div>
                    <div style="font-size: 0.75rem; color: #64748b;">{{ formatFileSize(file.size) }}</div>
                  </div>
                </div>
                <button type="button" @click.stop="removeEditSelectedFile(idx)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.25rem;"><i class="pi pi-times"></i></button>
              </div>
            </div>
          </div>

          <textarea v-model="editLessonForm.description" class="inp" style="min-height:70px" placeholder="Mô tả tóm tắt..."></textarea>
          
          <div style="display:flex; gap:1rem; align-items:center">
            <label>Thứ tự sắp xếp:</label>
            <input v-model="editLessonForm.sortOrder" type="number" class="inp" style="width:80px" required />
          </div>

          <div class="custom-modal-footer mt-4">
            <button type="button" class="btn-cancel" @click="showEditLessonModal = false">Hủy bỏ</button>
            <button type="submit" class="btn">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal Sửa Bài Kiểm Tra -->
  <div v-if="showEditExamModal" class="custom-modal-overlay">
    <div class="custom-modal-card max-w-xl">
      <div class="custom-modal-header">
        <i class="pi pi-pencil custom-modal-icon"></i>
        <h3>Chỉnh Sửa Bài Kiểm Tra</h3>
      </div>
      <div class="custom-modal-body modal-scrollable" ref="editExamModalBody">
        <form @submit.prevent="saveEditExam" class="frm-col">
          <input v-model="editExamForm.title" class="inp" placeholder="Tên bài kiểm tra..." required />
          <div style="display:flex;gap:1rem;align-items:center">
            <label>Thời gian (phút):</label>
            <input v-model="editExamForm.durationMinutes" type="number" class="inp" style="width:80px" required />
          </div>
          <div style="display:flex;gap:1rem;align-items:center">
            <label>Loại bài thi:</label>
            <select v-model="editExamForm.examType" class="si">
              <option value="regular">Thường xuyên</option>
              <option value="midterm">Giữa kỳ</option>
              <option value="final">Cuối kỳ</option>
            </select>
          </div>

          <!-- Bộ soạn câu hỏi trong Edit modal -->
          <div class="question-builder-box">
            <div class="qb-header">
              {{ editingQuestionIndexInEdit === null ? 'Soạn câu hỏi trắc nghiệm mới' : 'Chỉnh sửa câu hỏi trắc nghiệm' }}
            </div>
            <div class="frm-col-nested">
              <textarea v-model="editNewQuestionText" class="inp" style="min-height:60px" placeholder="Nhập câu hỏi..."></textarea>
              <div class="options-grid">
                <div class="opt-row"><span class="opt-lbl">A:</span><input v-model="editNewOptions[0]" class="inp" placeholder="Lựa chọn A..." /></div>
                <div class="opt-row"><span class="opt-lbl">B:</span><input v-model="editNewOptions[1]" class="inp" placeholder="Lựa chọn B..." /></div>
                <div class="opt-row"><span class="opt-lbl">C:</span><input v-model="editNewOptions[2]" class="inp" placeholder="Lựa chọn C..." /></div>
                <div class="opt-row"><span class="opt-lbl">D:</span><input v-model="editNewOptions[3]" class="inp" placeholder="Lựa chọn D..." /></div>
              </div>
              <div class="ans-row">
                <div class="flex-align">
                  <label class="mr-2">Đáp án đúng:</label>
                  <select v-model="editNewAnswer" class="si-sm">
                    <option :value="0">Đáp án A</option>
                    <option :value="1">Đáp án B</option>
                    <option :value="2">Đáp án C</option>
                    <option :value="3">Đáp án D</option>
                  </select>
                </div>
                <div v-if="editingQuestionIndexInEdit === null">
                  <button type="button" @click="addQuestionToEditExam" class="btn-add-q">
                    <i class="pi pi-plus"></i> Thêm câu hỏi
                  </button>
                </div>
                <div v-else style="display: flex; gap: 0.5rem;">
                  <button type="button" @click="cancelEditQuestionInEdit" class="btn-cancel-q-edit">
                    Hủy
                  </button>
                  <button type="button" @click="saveQuestionInEdit" class="btn-save-q-edit">
                    Cập nhật câu hỏi
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Danh sách câu hỏi trong Edit modal -->
          <div v-if="editExamQuestions.length > 0" class="added-questions-box">
            <div class="qb-header">Danh sách câu hỏi của bài kiểm tra ({{ editExamQuestions.length }})</div>
            <div class="added-q-list">
              <div v-for="(q, idx) in editExamQuestions" :key="q.id || idx" class="added-q-item" :style="editingQuestionIndexInEdit === idx ? 'border-color: #7c3aed; background: #faf5ff;' : ''">
                <div class="added-q-header">
                  <strong class="q-title-text">Câu {{ idx + 1 }}: {{ q.text }}</strong>
                  <div>
                    <button type="button" @click="startEditQuestionInEdit(idx)" class="btn-edit-q-inline" title="Sửa câu hỏi"><i class="pi pi-pencil"></i></button>
                    <button type="button" @click="removeQuestionFromEditExam(idx)" class="btn-del-q" title="Xóa câu hỏi"><i class="pi pi-trash"></i></button>
                  </div>
                </div>
                <div class="added-q-opts">
                  <div class="opt-text" :class="{ 'correct-opt': Number(q.answer) === 0 }">A. {{ q.options[0] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': Number(q.answer) === 1 }">B. {{ q.options[1] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': Number(q.answer) === 2 }">C. {{ q.options[2] }}</div>
                  <div class="opt-text" :class="{ 'correct-opt': Number(q.answer) === 3 }">D. {{ q.options[3] }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="custom-modal-footer mt-4">
            <button type="button" class="btn-cancel" @click="showEditExamModal = false; cancelEditQuestionInEdit();">Hủy bỏ</button>
            <button type="submit" class="btn">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Toast Thông Báo Custom (Góc trên cùng bên phải, tự đóng sau 3 giây) -->
  <div v-if="showNotificationModal" class="custom-toast-container" @click="showNotificationModal = false">
    <div class="custom-toast-card" :class="notificationType">
      <div class="custom-toast-content">
        <i v-if="notificationType === 'success'" class="pi pi-check-circle toast-icon success"></i>
        <i v-else-if="notificationType === 'error'" class="pi pi-times-circle toast-icon error"></i>
        <i v-else class="pi pi-exclamation-triangle toast-icon warning"></i>
        <div class="toast-text">
          <strong class="toast-title">{{ notificationTitle }}</strong>
          <span class="toast-message">{{ notificationMsg }}</span>
        </div>
      </div>
      <button class="toast-close-btn">&times;</button>
    </div>
  </div>

  <!-- Modal Xác Nhận Xóa Custom -->
  <div v-if="showConfirmDeleteModal" class="custom-modal-overlay" @click.self="showConfirmDeleteModal = false">
    <div class="custom-modal-card max-w-sm">
      <div class="custom-modal-header">
        <i class="pi pi-exclamation-circle text-red-500 custom-modal-icon"></i>
        <h3>{{ confirmTitle }}</h3>
      </div>
      <div class="custom-modal-body" style="padding: 0.5rem 0 1rem 0;">
        <p style="color: #4b5563; font-size: 0.95rem; line-height: 1.5; margin: 0;">{{ confirmMsg }}</p>
      </div>
      <div class="custom-modal-footer" style="padding-top: 0.75rem;">
        <button class="btn-cancel" @click="showConfirmDeleteModal = false">Hủy</button>
        <button class="btn" @click="executeDelete" style="background-color: #ef4444; border-color: #ef4444;">Xác nhận xóa</button>
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
.ch { background: #f9fafb; padding: 0.75rem 1.5rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; display: flex; justify-content: space-between; align-items: center; }
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
.badge-word {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}
.badge-pdf {
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

/* Tab switcher & Tab pane */
.tabs-nav {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1.5rem;
  padding-bottom: 2px;
}
.tab-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 600;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: -2px;
}
.tab-nav-btn:hover {
  color: #111827;
  border-bottom-color: #cbd5e1;
}
.tab-nav-btn.active {
  color: #7c3aed;
  border-bottom-color: #7c3aed;
}
.tab-pane {
  animation: fadeIn 0.3s ease-out;
}

/* Accordion bài kiểm tra & Chi tiết câu hỏi */
.exam-card-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}
.exam-card-item:hover {
  border-color: #d1d5db;
}
.exam-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
}
.exam-card-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-weight: 600;
  color: #111827;
}
.exam-title-text {
  font-size: 0.95rem;
}
.badge-duration {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: #dbeafe;
  color: #1e40af;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}
.badge-exam-type {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
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
.exam-card-body {
  padding: 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.preview-q-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.preview-q-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
}
.preview-q-text {
  font-size: 0.9rem;
  color: #1e293b;
  margin-bottom: 0.5rem;
}
.preview-q-opts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}
.preview-opt-text {
  font-size: 0.8rem;
  color: #64748b;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid transparent;
}
.empty-questions {
  font-size: 0.85rem;
  color: #9ca3af;
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
.ml-2 {
  margin-left: 0.5rem;
}

/* Modal Popup Styles */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}
.custom-modal-card {
  background: #ffffff;
  border-radius: 12px;
  width: 90%;
  padding: 1.75rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
}
.max-w-sm {
  max-width: 24rem;
}
.max-w-lg {
  max-width: 32rem;
}
.max-w-xl {
  max-width: 42rem;
}
.modal-scrollable {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.5rem;
}
.modal-scrollable::-webkit-scrollbar {
  width: 6px;
}
.modal-scrollable::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.custom-modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.75rem;
}
.custom-modal-icon {
  font-size: 1.5rem;
  color: #7c3aed;
}
.custom-modal-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.custom-modal-body {
  text-align: left;
}
.custom-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}
.btn-cancel {
  padding: 0.6rem 1.25rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: #f9fafb;
  border-color: #cbd5e1;
}
.btn-edit-inline {
  color: #2563eb;
  background: none;
  border: none;
  cursor: pointer;
  padding: .2rem;
  transition: color 0.2s;
}
.btn-edit-inline:hover {
  color: #1d4ed8;
}
.mx-2 {
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}
.mr-2 {
  margin-right: 0.5rem;
}
.lesson-actions {
  display: flex;
  align-items: center;
}

@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.btn-create-header {
  padding: 0.5rem 1rem;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}
.btn-create-header:hover {
  background: #6d28d9;
  box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2);
}
.lesson-card-static {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}
.lesson-card-static:hover {
  border-color: #d1d5db;
}
.lesson-card-header-static {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #f9fafb;
  user-select: none;
}
.exam-card-item-static {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}
.exam-card-item-static:hover {
  border-color: #d1d5db;
}
.exam-card-header-static {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #f9fafb;
  user-select: none;
}
.btn-view-inline {
  color: #10b981;
  background: none;
  border: none;
  cursor: pointer;
  padding: .2rem;
  transition: color 0.2s;
}
.btn-view-inline:hover {
  color: #059669;
}

/* Custom Toast Notification CSS */
.custom-toast-container {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10000;
  animation: slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.custom-toast-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border-left: 4px solid #7c3aed;
  min-width: 280px;
  max-width: 380px;
  gap: 1rem;
}
.custom-toast-card.success {
  border-left-color: #10b981;
}
.custom-toast-card.error {
  border-left-color: #ef4444;
}
.custom-toast-card.warning {
  border-left-color: #f59e0b;
}
.custom-toast-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.toast-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}
.toast-icon.success {
  color: #10b981;
}
.toast-icon.error {
  color: #ef4444;
}
.toast-icon.warning {
  color: #f59e0b;
}
.toast-text {
  display: flex;
  flex-direction: column;
  text-align: left;
}
.toast-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1f2937;
}
.toast-message {
  font-size: 0.825rem;
  color: #4b5563;
  margin-top: 0.15rem;
  line-height: 1.4;
}
.toast-close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.toast-close-btn:hover {
  color: #4b5563;
}
@keyframes slideInRight {
  from {
    transform: translateX(120%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.btn-edit-q-inline {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.2rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: 0.5rem;
}
.btn-edit-q-inline:hover {
  background: #dbeafe;
  color: #1d4ed8;
}
.btn-save-q-edit {
  background: #ea580c;
  color: #fff;
  border: none;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}
.btn-save-q-edit:hover {
  background: #c2410c;
}
.btn-cancel-q-edit {
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.btn-cancel-q-edit:hover {
  background: #f9fafb;
}
</style>
