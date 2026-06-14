<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiGet } from '@/lib/api'
import { useToast } from 'primevue/usetoast'
import pvToast from 'primevue/toast'
import html2pdf from 'html2pdf.js'

interface ClassItem {
  id: string
  name: string
  schedule: string
  room: string
  credits: number
  semester: string
  subject?: {
    id: string
    code: string
    name: string
    credits: number
  }
  instructor?: {
    id: string
    fullName?: string
    full_name?: string
  }
}

const registeredClasses = ref<ClassItem[]>([])
const loading = ref(true)
const errorMessage = ref<string | null>(null)
const toast = useToast()

// Lesson Viewer State
const activeClassForLessons = ref<any | null>(null)
const classLessons = ref<any[]>([])
const loadingLessons = ref(false)
const expandedStudentLessons = ref<string[]>([])
const exportingPDF = ref<string | null>(null)

// Format class name dynamically helper
const formatClassDisplayName = (c: any) => {
  if (!c) return c
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
}

async function loadData() {
  loading.value = true
  errorMessage.value = null
  try {
    const res = await apiGet<{ success: boolean; data: any[] }>('/classes/my-registrations')
    if (res.success) {
      registeredClasses.value = (res.data || []).map(r => formatClassDisplayName(r.class)).filter(Boolean)
    } else {
      errorMessage.value = 'Không thể tải danh sách lớp học.'
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Có lỗi xảy ra khi tải dữ liệu.'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

const totalCredits = computed(() => {
  return registeredClasses.value.reduce((sum: number, c: ClassItem) => sum + (c.credits || c.subject?.credits || 0), 0)
})

// === Lesson Logic ===
async function viewLessons(cls: any) {
  activeClassForLessons.value = cls
  classLessons.value = []
  loadingLessons.value = true
  expandedStudentLessons.value = []
  try {
    const res = await apiGet<any>(`/lessons/class/${cls.id}`)
    classLessons.value = res.data || res || []
  } catch (err) {
    console.error('Failed to load class lessons:', err)
  } finally {
    loadingLessons.value = false
  }
}

function closeLessonsModal() {
  activeClassForLessons.value = null
  classLessons.value = []
}

function toggleStudentLessonExpand(id: string) {
  if (expandedStudentLessons.value.includes(id)) {
    expandedStudentLessons.value = expandedStudentLessons.value.filter((x: string) => x !== id)
  } else {
    expandedStudentLessons.value.push(id)
  }
}

function parseLessonContent(contentStr: string) {
  try {
    const parsed = JSON.parse(contentStr)
    const type = parsed.type || (parsed.youtubeId ? 'video' : (parsed.pdfUrl || parsed.fileUrl || parsed.files ? 'file' : 'doc'))
    const fileUrl = parsed.fileUrl || parsed.pdfUrl || ''
    const fileExt = parsed.fileExt || (fileUrl.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf')
    const fileName = parsed.fileName || (fileUrl ? fileUrl.split('/').pop()?.split('?')[0] || 'Tài liệu' : '')
    
    let files = parsed.files || []
    if (files.length === 0 && fileUrl) {
      files = [{
        fileUrl,
        fileExt,
        fileName
      }]
    }
    
    return {
      type: type === 'pdf' ? 'file' : type,
      youtubeId: parsed.youtubeId || '',
      docContent: parsed.docContent || '',
      fileUrl: fileUrl || (files[0]?.fileUrl || ''),
      pdfUrl: fileUrl || (files[0]?.fileUrl || ''),
      fileName: fileName || (files[0]?.fileName || 'Tài liệu'),
      fileExt: fileExt || (files[0]?.fileExt || 'pdf'),
      files,
      description: parsed.description || '',
    }
  } catch {
    return {
      type: 'video',
      youtubeId: '',
      docContent: '',
      fileUrl: '',
      pdfUrl: '',
      fileName: '',
      fileExt: '',
      files: [],
      description: contentStr || '',
    }
  }
}

function exportToPDF(lesson: any) {
  const element = document.getElementById(`pdf-content-${lesson.id}`)
  if (!element) return
  
  exportingPDF.value = lesson.id
  
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
    toast.add({ severity: 'error', summary: 'Lỗi xuất PDF', detail: 'Có lỗi xảy ra khi xuất file PDF.', life: 5000 })
  })
}
</script>

<template>
  <pv-toast />
  <div class="mono-wrapper">
    <!-- Breadcrumb & Header -->
    <div class="page-header">
      <div>
        <div class="breadcrumb">Học vụ / <span>Lớp học của tôi</span></div>
        <h1 class="page-title">Lớp học của tôi</h1>
        <div class="page-subtitle">Danh sách tất cả các lớp học bạn đã đăng ký trong học kỳ này.</div>
      </div>
      <!-- Widget Thống kê -->
      <div class="stats-row">
        <div class="stat-badge-card">
          <div class="stat-badge-icon bg-blue"><i class="pi pi-bookmark-fill"></i></div>
          <div class="stat-badge-info">
            <span class="stat-badge-value">{{ registeredClasses.length }}</span>
            <span class="stat-badge-label">Lớp đã ĐK</span>
          </div>
        </div>
        <div class="stat-badge-card">
          <div class="stat-badge-icon bg-green"><i class="pi pi-book"></i></div>
          <div class="stat-badge-info">
            <span class="stat-badge-value">{{ totalCredits }}</span>
            <span class="stat-badge-label">Tổng tín chỉ</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alert Messages -->
    <div v-if="errorMessage" class="mono-alert alert-error mb-4">
      <i class="pi pi-times-circle"></i>
      <div><strong>LỖI:</strong> {{ errorMessage }}</div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-center">
      <i class="pi pi-spin pi-spinner" style="font-size:2.5rem;color:#6b7280"></i>
      <div>Đang tải danh sách lớp học của bạn...</div>
    </div>

    <!-- Main Content -->
    <template v-else>
      <div v-if="registeredClasses.length === 0" class="empty-state">
        <i class="pi pi-folder-open" style="font-size:4rem;color:#9ca3af;margin-bottom:1rem"></i>
        <h3>Bạn chưa đăng ký lớp học nào</h3>
        <p class="mb-4">Vui lòng hoàn tất đăng ký lớp học tại phân hệ đăng ký.</p>
        <RouterLink to="/registration" class="btn-primary">Đăng ký lớp học ngay</RouterLink>
      </div>

      <div v-else class="classes-grid">
        <div 
          v-for="cls in registeredClasses" 
          :key="cls.id" 
          class="class-card-premium"
        >
          <div class="card-header">
            <span class="class-code">{{ cls.subject?.code || 'N/A' }}</span>
            <span class="status-badge badge-active">Đang học</span>
          </div>
          <div class="card-body">
            <h3 class="subject-name">{{ cls.name }}</h3>
            <div class="info-row"><i class="pi pi-book"></i><span>Số tín chỉ: <strong>{{ cls.credits || cls.subject?.credits || 0 }}</strong> TC</span></div>
            <div class="info-row"><i class="pi pi-user"></i><span>GV: <strong>{{ cls.instructor?.fullName || cls.instructor?.full_name || 'Chưa phân công' }}</strong></span></div>
            <div class="info-row"><i class="pi pi-calendar"></i><span>Lịch học: {{ cls.schedule || 'Chưa xếp lịch' }}</span></div>
            <div class="info-row"><i class="pi pi-map-marker"></i><span>Phòng: {{ cls.room || 'Chưa xếp phòng' }}</span></div>
            <div class="info-row"><i class="pi pi-bookmark"></i><span>Học kỳ: {{ cls.semester || 'N/A' }}</span></div>
          </div>
          <div class="card-footer">
            <button class="btn-action w-full" @click="viewLessons(cls)">
              <i class="pi pi-play-circle"></i>
              Vào học ngay
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Xem Bài Học / Bài Giảng -->
    <div v-if="activeClassForLessons" class="modal-overlay" @click.self="closeLessonsModal">
      <div class="modal-content-premium">
        <div class="modal-header">
          <div class="modal-header-info">
            <span class="modal-pre-title">LỚP HỌC: {{ activeClassForLessons.name }}</span>
            <h2 class="modal-title">{{ activeClassForLessons.subject?.name }}</h2>
          </div>
          <button @click="closeLessonsModal" class="btn-close"><i class="pi pi-times"></i></button>
        </div>

        <div class="modal-body-premium">
          <div v-if="loadingLessons" class="loading-center-lessons">
            <i class="pi pi-spin pi-spinner spinner-purple" style="font-size: 2rem; color: #7c3aed"></i>
            <span style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280">Đang tải danh sách bài học...</span>
          </div>
          <div v-else-if="classLessons.length === 0" class="empty-lessons">
            <i class="pi pi-inbox" style="font-size: 3rem; color: #9ca3af; margin-bottom: 1rem"></i>
            <h3>Giảng viên chưa đăng tải bài giảng nào cho lớp này.</h3>
            <p>Vui lòng quay lại sau!</p>
          </div>
          <div v-else class="student-lessons-list">
            <div v-for="(l, idx) in classLessons" :key="l.id" class="student-lesson-item">
              <div class="student-lesson-header" @click="toggleStudentLessonExpand(l.id)">
                <div class="student-lesson-title">
                  <span class="lesson-index">Bài {{ Number(idx) + 1 }}</span>
                  <span class="lesson-name">{{ l.title }}</span>
                  <span v-if="parseLessonContent(l.content).type === 'video'" class="badge-video ml-2">
                    <i class="pi pi-video mr-1"></i>Video
                  </span>
                  <span v-else-if="parseLessonContent(l.content).type === 'doc'" class="badge-doc ml-2">
                    <i class="pi pi-file mr-1"></i>Tài liệu
                  </span>
                  <span v-else-if="parseLessonContent(l.content).type === 'file'" class="ml-2" :class="parseLessonContent(l.content).fileExt === 'docx' ? 'badge-word' : 'badge-pdf'">
                    <i :class="parseLessonContent(l.content).fileExt === 'docx' ? 'pi pi-file-word mr-1' : 'pi pi-file-pdf mr-1'"></i>{{ parseLessonContent(l.content).fileExt === 'docx' ? 'Word' : 'PDF' }}
                  </span>
                </div>
                <i class="pi" :class="expandedStudentLessons.includes(l.id) ? 'pi-chevron-up text-purple-600' : 'pi-chevron-down'"></i>
              </div>

              <div v-if="expandedStudentLessons.includes(l.id)" class="student-lesson-body">
                <!-- Video player -->
                <div v-if="parseLessonContent(l.content).type === 'video' && parseLessonContent(l.content).youtubeId" class="student-video-wrapper mb-3">
                  <iframe :src="'https://www.youtube.com/embed/' + parseLessonContent(l.content).youtubeId" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;" allowfullscreen></iframe>
                </div>

                <!-- Document viewer -->
                <div v-if="parseLessonContent(l.content).type === 'doc'" class="student-doc-wrapper">
                  <div class="doc-actions mb-3">
                    <button @click="exportToPDF(l)" class="btn-pdf-download" :disabled="exportingPDF === l.id">
                      <i v-if="exportingPDF === l.id" class="pi pi-spin pi-spinner mr-1"></i>
                      <i v-else class="pi pi-file-pdf mr-1"></i>
                      Xuất bài giảng PDF
                    </button>
                  </div>
                  
                  <div :id="'pdf-content-' + l.id" class="pdf-print-area">
                    <div class="pdf-header-print">
                      <div class="pdf-header-row">
                        <span class="pdf-school">HỆ THỐNG QUẢN LÝ HỌC TẬP - LMS</span>
                        <span class="pdf-class">Lớp: {{ activeClassForLessons.name }}</span>
                      </div>
                      <div class="pdf-subject">Môn học: {{ activeClassForLessons.subject?.name }} ({{ activeClassForLessons.subject?.code }})</div>
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

                <!-- Generic file content area (PDF & DOCX) -->
                <div v-if="parseLessonContent(l.content).type === 'file'" class="student-pdf-wrapper mb-3" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; border: 0; background: transparent; box-shadow: none; padding: 0;">
                  <div v-for="(file, idx) in parseLessonContent(l.content).files" :key="idx" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.9rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <span>Tài liệu {{ idx + 1 }}: {{ file.fileName }}</span>
                      <a :href="file.fileUrl" :download="file.fileName" target="_blank" class="btn-pdf-download text-center no-underline" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                        <i class="pi pi-download mr-1"></i> Tải về ({{ file.fileExt.toUpperCase() }})
                      </a>
                    </div>
                    
                    <!-- Show inline PDF viewer if PDF -->
                    <div v-if="file.fileExt === 'pdf'" class="pdf-viewer-container" style="height: 350px;">
                      <iframe :src="file.fileUrl" class="pdf-iframe-viewer" style="height: 100%;" frameborder="0"></iframe>
                    </div>
                    <!-- Show premium download card if DOCX -->
                    <div v-else class="docx-download-card" style="border: 1px solid #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px;">
                      <div class="docx-info">
                        <i class="pi pi-file-word docx-icon" style="font-size: 2rem;"></i>
                        <div class="docx-details">
                          <span class="docx-filename" style="font-size: 0.85rem;">{{ file.fileName || 'Tài liệu Word' }}</span>
                          <span class="docx-hint">Tài liệu Word (.docx) cần được tải xuống để xem nội dung</span>
                        </div>
                      </div>
                      <a :href="file.fileUrl" :download="file.fileName" target="_blank" class="btn-download-docx" style="padding: 0.4rem 0.80rem; font-size: 0.8rem;">
                        <i class="pi pi-download mr-1"></i> Tải xuống (.docx)
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Description for Video and File lessons -->
                <div v-if="['video', 'file'].includes(parseLessonContent(l.content).type) && parseLessonContent(l.content).description" class="student-lesson-desc">
                  <strong style="color: #374151; font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">Mô tả / Ghi chú:</strong>
                  {{ parseLessonContent(l.content).description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mono-wrapper { display: flex; flex-direction: column; padding: 1.5rem 2rem; animation: fadeIn 0.3s ease-out; }
.page-header { margin-bottom: 2.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: flex-end; }
.breadcrumb { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
.breadcrumb span { color: #111827; font-weight: 600; }
.page-title { font-size: 1.85rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #111827; letter-spacing: -0.025em; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; }

.stats-row { display: flex; gap: 1.25rem; }
.stat-badge-card { display: flex; align-items: center; gap: 0.75rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 0.625rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.stat-badge-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.stat-badge-icon i { font-size: 1rem; color: #fff; }
.bg-blue { background: #3b82f6; }
.bg-green { background: #10b981; }
.stat-badge-info { display: flex; flex-direction: column; }
.stat-badge-value { font-size: 1.25rem; font-weight: 700; color: #111827; line-height: 1.2; }
.stat-badge-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; }

.mono-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-radius: 8px; font-size: 0.875rem; }
.alert-error { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.mb-4 { margin-bottom: 1rem; }

.loading-center { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem; color: #6b7280; font-weight: 500; }
.empty-state { text-align: center; padding: 5rem 2rem; background: #fff; border: 1px dashed #d1d5db; border-radius: 16px; color: #4b5563; max-width: 600px; margin: 2rem auto; }
.empty-state h3 { font-size: 1.25rem; color: #111827; margin-bottom: 0.5rem; font-weight: 600; }
.empty-state p { font-size: 0.9rem; color: #6b7280; }

.btn-primary { display: inline-flex; align-items: center; gap: 0.5rem; background: #111827; color: #fff; border: 1px solid #111827; padding: 0.625rem 1.25rem; border-radius: 8px; font-size: 0.9rem; font-weight: 500; text-decoration: none; cursor: pointer; transition: all 0.2s; }
.btn-primary:hover { background: #374151; }

.classes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.75rem; }
.class-card-premium { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
.class-card-premium:hover { box-shadow: 0 12px 20px -3px rgba(0,0,0,0.08); transform: translateY(-4px); border-color: #d1d5db; }
.card-header { padding: 1.125rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
.class-code { font-weight: 700; color: #111827; font-family: monospace; font-size: 1.05rem; }
.status-badge { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.625rem; border-radius: 9999px; }
.badge-active { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

.card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; flex-grow: 1; }
.subject-name { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem 0; line-height: 1.35; }
.info-row { display: flex; align-items: center; gap: 0.625rem; font-size: 0.875rem; color: #475569; }
.info-row i { color: #94a3b8; font-size: 0.95rem; }

.card-footer { padding: 1.25rem 1.5rem; border-top: 1px solid #f1f5f9; }
.w-full { width: 100%; }
.btn-action { padding: 0.75rem; border: 1px solid #4f46e5; background: #4f46e5; color: #fff; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
.btn-action:hover { background: #4338ca; border-color: #4338ca; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); }

/* Premium Modal styling */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1100; animation: fadeIn 0.2s ease-out; }
.modal-content-premium { background: #fff; border-radius: 20px; width: 90%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); overflow: hidden; border: 1px solid #e2e8f0; }
.modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
.modal-header-info { display: flex; flex-direction: column; gap: 0.25rem; }
.modal-pre-title { font-size: 0.75rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; }
.modal-title { font-size: 1.35rem; font-weight: 850; color: #0f172a; margin: 0; }
.btn-close { background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer; padding: 0.5rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s; }
.btn-close:hover { background: #e2e8f0; color: #0f172a; }

.modal-body-premium { padding: 2rem; overflow-y: auto; flex-grow: 1; background: #fdfdfd; }
.loading-center-lessons { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; }
.spinner-purple { animation: fa-spin 2s infinite linear; }
.empty-lessons { text-align: center; padding: 4rem 2rem; color: #64748b; }
.empty-lessons h3 { font-size: 1.15rem; color: #1e293b; margin-bottom: 0.5rem; }
.empty-lessons p { font-size: 0.875rem; }

.student-lessons-list { display: flex; flex-direction: column; gap: 1rem; }
.student-lesson-item { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: border-color 0.2s; }
.student-lesson-item:hover { border-color: #cbd5e1; }
.student-lesson-header { padding: 1.125rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; background: #fff; }
.student-lesson-title { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.lesson-index { font-size: 0.75rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase; }
.lesson-name { font-weight: 600; color: #1e293b; font-size: 0.95rem; }

/* Lesson Badges */
.badge-video { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; }
.badge-doc { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; }
.badge-pdf { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; }
.badge-word { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; }

.student-lesson-body { padding: 1.5rem; border-top: 1px solid #f1f5f9; background: #fafbfc; }
.student-video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.student-video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

/* Premium Docs/PDF actions & area */
.doc-actions { display: flex; justify-content: flex-end; }
.btn-pdf-download { display: inline-flex; align-items: center; gap: 0.375rem; background: #fff; border: 1px solid #d1d5db; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.825rem; color: #374151; font-weight: 600; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.btn-pdf-download:hover { background: #f9fafb; border-color: #cbd5e1; color: #111827; }
.no-underline { text-decoration: none !important; }

.pdf-print-area { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.pdf-header-print { margin-bottom: 1.5rem; display: none; } /* Only shows in PDF print */
.pdf-header-row { display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; font-weight: 600; }
.pdf-subject { font-size: 0.85rem; color: #475569; margin-top: 0.25rem; font-weight: 600; }
.pdf-divider { border: 0; border-top: 1px solid #e2e8f0; margin: 0.75rem 0 0; }
.pdf-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 1.25rem 0; line-height: 1.3; }
.pdf-body-content { font-size: 0.95rem; color: #334155; line-height: 1.7; word-break: break-word; }
.pdf-desc-content { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed #e2e8f0; }

.pdf-viewer-container { border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.pdf-iframe-viewer { width: 100%; height: 500px; border: 0; }

.docx-download-card { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; gap: 1rem; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.docx-info { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 200px; }
.docx-icon { font-size: 2.25rem; color: #2563eb; }
.docx-details { display: flex; flex-direction: column; gap: 0.25rem; }
.docx-filename { font-weight: 600; color: #1e293b; font-size: 0.9rem; }
.docx-hint { font-size: 0.75rem; color: #64748b; }
.btn-download-docx { background: #2563eb; color: #fff; border: 1px solid #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; transition: all 0.2s; }
.btn-download-docx:hover { background: #1d4ed8; border-color: #1d4ed8; }

.student-lesson-desc { margin-top: 1rem; background: #f1f5f9; padding: 1rem; border-radius: 10px; font-size: 0.85rem; color: #475569; line-height: 1.5; border-left: 4px solid #cbd5e1; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(359deg); } }

/* PDF printing configurations */
@media print {
  body * { visibility: hidden; }
  .pdf-print-area, .pdf-print-area * { visibility: visible; }
  .pdf-print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; }
  .pdf-header-print { display: block; }
}
</style>
