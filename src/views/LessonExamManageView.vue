<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'

const authStore = useAuthStore()

const classes = ref<any[]>([])
const selectedClass = ref<string>('')
const lessons = ref<any[]>([])
const exams = ref<any[]>([])
const loading = ref(true)
const msg = ref<string | null>(null)

// Forms
const lessonForm = ref({ title: '', youtubeUrl: '', description: '', sortOrder: 1 })
const examForm = ref({ title: '', durationMinutes: 60 })

// Multiple Choice Question Builder State
const questions = ref<any[]>([])
const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newAnswer = ref(0) // 0 for A, 1 for B, 2 for C, 3 for D

function addQuestion() {
  if (!newQuestionText.value.trim()) {
    alert('Nội dung câu hỏi không được để trống!')
    return
  }
  if (newOptions.value.some(o => !o.trim())) {
    alert('Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D!')
    return
  }
  questions.value.push({
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
      youtubeId: parsed.youtubeId || '',
      description: parsed.description || ''
    }
  } catch {
    return {
      youtubeId: '',
      description: contentStr || ''
    }
  }
}

async function loadClasses() {
  loading.value = true
  try {
    const res = await apiGet<any>('/classes')
    const all = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])
    // Lọc lớp mà GV này dạy hoặc TBM quản lý
    classes.value = all.filter(c => 
      (c.instructor?.id || c.instructor_id) === authStore.profile?.id || 
      authStore.profile?.rank >= 70 // PĐT/HR/Admin thấy hết
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
  } catch (err: any) {
    msg.value = err.message
  }
}

onMounted(loadClasses)

async function createLesson() {
  if (!selectedClass.value) return
  try {
    const ytId = getYouTubeId(lessonForm.value.youtubeUrl)
    const contentPayload = JSON.stringify({
      youtubeId: ytId,
      description: lessonForm.value.description
    })

    await apiPost('/lessons', {
      classId: selectedClass.value,
      title: lessonForm.value.title,
      content: contentPayload,
      sortOrder: lessonForm.value.sortOrder
    })
    
    lessonForm.value = { title: '', youtubeUrl: '', description: '', sortOrder: lessons.value.length + 2 }
    loadClassContent()
    msg.value = 'Tạo bài học thành công'
  } catch (err: any) { msg.value = err.message }
}

async function createExam() {
  if (!selectedClass.value) return
  if (questions.value.length === 0) {
    alert('Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm trước khi tạo bài kiểm tra!')
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
    msg.value = 'Tạo bài kiểm tra trắc nghiệm thành công'
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
      <div class="st">Giảng viên tạo nội dung bài giảng và cấu hình bài kiểm tra cho lớp.</div>
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

      <div class="split">
        <!-- Bài học -->
        <div class="flex-1">
          <div class="crd">
            <div class="ch"><span>Bài giảng ({{ lessons.length }})</span></div>
            <div class="cb">
              <!-- Form tạo bài giảng chuẩn Youtube Iframe -->
              <form @submit.prevent="createLesson" class="frm-col mb-6">
                <input v-model="lessonForm.title" class="inp" placeholder="Tên bài giảng mới (Ví dụ: Bài 1 - Nhập môn)..." required />
                <input v-model="lessonForm.youtubeUrl" class="inp" placeholder="Link Video Youtube (Ví dụ: https://www.youtube.com/watch?v=...)..." />
                <textarea v-model="lessonForm.description" class="inp" style="min-height:70px" placeholder="Mô tả bài giảng / Ghi chú cho sinh viên..."></textarea>
                <button type="submit" class="btn"><i class="pi pi-plus"></i> Thêm bài giảng</button>
              </form>

              <!-- Danh sách bài giảng Accordion Premium -->
              <div class="lst">
                <div v-for="l in lessons" :key="l.id" class="lesson-card">
                  <div class="lesson-card-header" @click="toggleLessonExpand(l.id)">
                    <div class="lesson-card-title">
                      <i class="pi mr-2" :class="expandedLessons.includes(l.id) ? 'pi-chevron-down text-purple-600' : 'pi-chevron-right'"></i>
                      <span class="lesson-title-text">{{ l.title }}</span>
                      <span v-if="parseLessonContent(l.content).youtubeId" class="badge-video ml-2"><i class="pi pi-video mr-1"></i>Video</span>
                    </div>
                    <button @click.stop="deleteLesson(l.id)" class="btn-del"><i class="pi pi-trash"></i></button>
                  </div>

                  <!-- Expanded Body -->
                  <div v-if="expandedLessons.includes(l.id)" class="lesson-card-body">
                    <!-- YouTube video iframe container -->
                    <div v-if="parseLessonContent(l.content).youtubeId" class="video-wrapper mb-3">
                      <iframe 
                        :src="'https://www.youtube.com/embed/' + parseLessonContent(l.content).youtubeId" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                      </iframe>
                    </div>
                    <!-- Description -->
                    <div v-if="parseLessonContent(l.content).description" class="lesson-description">
                      {{ parseLessonContent(l.content).description }}
                    </div>
                    <div v-else-if="!parseLessonContent(l.content).youtubeId" class="empty-desc">
                      Không có nội dung bài giảng bổ sung.
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

                <!-- BỘ TẠO CÂU HỎI TRẮC NGHIỆM TƯƠNG TÁC -->
                <div class="question-builder-box">
                  <div class="qb-header">Soạn câu hỏi trắc nghiệm</div>
                  
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
                      <button type="button" @click="addQuestion" class="btn-add-q">
                        <i class="pi pi-plus"></i> Thêm câu hỏi
                      </button>
                    </div>
                  </div>
                </div>

                <!-- DANH SÁCH CÂU HỎI ĐÃ SOẠN -->
                <div v-if="questions.length > 0" class="added-questions-box">
                  <div class="qb-header">Danh sách câu hỏi đã thêm ({{ questions.length }})</div>
                  <div class="added-q-list">
                    <div v-for="(q, idx) in questions" :key="idx" class="added-q-item">
                      <div class="added-q-header">
                        <strong class="q-title-text">Câu {{ idx + 1 }}: {{ q.text }}</strong>
                        <button type="button" @click="removeQuestion(idx)" class="btn-del-q"><i class="pi pi-trash"></i></button>
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
    </template>
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
</style>
