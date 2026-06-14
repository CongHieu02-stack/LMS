<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiGet, apiPut } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import html2pdf from 'html2pdf.js'
import { useToast } from 'primevue/usetoast'
import pvToast from 'primevue/toast'

const authStore = useAuthStore()
const toast = useToast()

const isStudent = computed(() => authStore.profile?.role === 'SINH_VIEN')

const subjectLink = computed(() => {
  if (authStore.hasPermission('subject_approve')) return '/admin/subjects'
  if (authStore.hasPermission('subject_propose')) return '/subjects/propose'
  return '/dashboard'
})

const classLink = computed(() => {
  if (authStore.hasPermission('class_create') || authStore.hasPermission('class_quantity_approve')) return '/admin/classes'
  if (authStore.hasPermission('class_view')) return '/admin/classes/search'
  if (authStore.hasPermission('class_quantity_approve')) return '/admin/classes/approve'
  if (authStore.hasPermission('instructor_assign')) return '/admin/classes/assign'
  if (authStore.hasPermission('lesson_exam_manage')) return '/lessons'
  if (authStore.hasPermission('class_quantity_propose')) return '/classes/propose'
  return '/dashboard'
})

const departmentLink = computed(() => {
  if (authStore.hasPermission('subject_approve')) return '/admin/departments/approve'
  return '/dashboard'
})

/** Thông tin thẻ thống kê cho Admin */
const statsCards = computed(() => [
  {
    label: 'Vai trò hiện tại',
    value: authStore.displayRole || 'Chưa cập nhật',
    icon: 'pi pi-shield',
    primary: true,
  },
  {
    label: 'Cấp bậc (Rank)',
    value: String(authStore.profile?.rank || 0),
    icon: 'pi pi-star',
    primary: false,
  },
  {
    label: 'Địa chỉ Email',
    value: authStore.profile?.email || '',
    icon: 'pi pi-envelope',
    primary: false,
  },
])

/** Ánh xạ rank → mô tả quyền hạn */
const rankDescription: Record<number, string> = {
  100: 'Quản trị tối cao. Được bảo vệ tuyệt đối.',
  90: 'Kế thừa quyền vận hành. Phê duyệt môn học mới.',
  80: 'Tạo và phân quyền cho các role cấp dưới.',
  70: 'Quản lý chương trình đào tạo và lịch học.',
  60: 'Quản lý giảng viên và môn học trong bộ môn.',
  50: 'Giảng dạy và quản lý lớp học.',
  10: 'Đăng ký lớp học và tham gia thi cử.',
}

// ==========================================
// AVATAR UPLOAD LOGIC
// ==========================================
const fileInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

function triggerAvatarUpload() {
  fileInput.value?.click()
}

async function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.add({ severity: 'error', summary: 'Lỗi định dạng', detail: 'Vui lòng chọn một file hình ảnh hợp lệ.', life: 4000 })
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.add({ severity: 'error', summary: 'Kích thước quá lớn', detail: 'Kích thước ảnh tối đa là 2MB.', life: 4000 })
    return
  }

  uploadingAvatar.value = true
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${authStore.profile?.id}-${Math.random()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)

    const res = await apiPut<any>(`/profiles/${authStore.profile?.id}`, {
      avatar_url: data.publicUrl
    })

    if (res.success) {
      if (authStore.fetchCurrentProfile) {
        await authStore.fetchCurrentProfile()
      } else {
        window.location.reload()
      }
    }
  } catch (error: any) {
    console.error('Lỗi khi tải lên ảnh đại diện:', error)
    toast.add({ severity: 'error', summary: 'Lỗi tải ảnh', detail: error.message, life: 5000 })
  } finally {
    uploadingAvatar.value = false
    if (target) target.value = ''
  }
}

// Student Real Data State
const loadingStudent = ref(false)
const availableClasses = ref<any[]>([])
const upcomingExams = ref<any[]>([])
const gpaDisplay = ref('0.0')
const registeredCount = ref(0)
const myRegisteredClasses = ref<any[]>([])

// Student Lessons Viewer State
const activeClassForLessons = ref<any | null>(null)
const classLessons = ref<any[]>([])
const loadingLessons = ref(false)
const expandedStudentLessons = ref<string[]>([])

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
    expandedStudentLessons.value = expandedStudentLessons.value.filter((x) => x !== id)
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
      videoNote: parsed.videoNote || '',
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
      videoNote: '',
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

const exportingPDF = ref<string | null>(null)

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

  // Chạy html2pdf và lưu file
  html2pdf().from(element).set(opt).save().then(() => {
    exportingPDF.value = null
  }).catch((err: any) => {
    console.error('PDF export error:', err)
    exportingPDF.value = null
    toast.add({ severity: 'error', summary: 'Lỗi xuất PDF', detail: 'Có lỗi xảy ra khi xuất file PDF.', life: 5000 })
  })
}

async function loadStudentData() {
  if (!isStudent.value) return
  loadingStudent.value = true
  try {
    const [classRes, regRes, gradeRes] = await Promise.all([
      apiGet<any>('/classes'),
      apiGet<{ success: boolean; data: any[] }>('/classes/my-registrations'),
      apiGet<{ success: boolean; data: any[] }>('/grades/me'),
    ])

    // Helper to format class name
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

    // 1. Lớp đã đăng ký
    const regs = regRes.data || []
    registeredCount.value = regs.length
    myRegisteredClasses.value = regs.map((r) => formatClassDisplayName(r.class)).filter(Boolean)
    const myClassIds = regs.map((r) => r.class?.id || r.class_id)

    // Helper to convert to scale 4
    function toScale4(score: number): number {
      if (score === null || score === undefined) return 0.0
      return score * 0.4
    }

    // 2. Điểm GPA
    const grades = gradeRes.data || []
    const validGrades = grades.filter(g => g.averageScore !== null)
    let totalCredits = 0
    let totalScore10 = 0
    let totalScore4 = 0
    validGrades.forEach((g) => {
      const tc = g.credits || 0
      totalCredits += tc
      const rawScore = parseFloat(g.averageScore) || 0
      totalScore10 += rawScore * tc
      totalScore4 += toScale4(rawScore) * tc
    })
    if (totalCredits > 0) {
      const g10 = (totalScore10 / totalCredits).toFixed(2)
      const g4 = (totalScore4 / totalCredits).toFixed(2)
      gpaDisplay.value = `${g10} / ${g4}`
    } else {
      gpaDisplay.value = '0.00 / 0.00'
    }

    // 3. Lớp đang mở (Gợi ý 2 lớp chưa đăng ký)
    const allClasses = classRes.data || classRes
    if (Array.isArray(allClasses)) {
      availableClasses.value = allClasses
        .map(formatClassDisplayName)
        .filter(
          (c) => !myClassIds.includes(c.id) && 
                 ['approved', 'APPROVED', 'open_for_reg', 'open'].includes(c.status) &&
                 (c.remainingSlots || c.remaining_slots || 0) > 0,
        )
        .slice(0, 2)
    }

    // 4. Lịch thi sắp tới (từ các lớp đã đăng ký)
    let exams: any[] = []
    for (const cId of myClassIds) {
      try {
        const eRes = await apiGet<{ success: boolean; data: any[] }>(
          `/exam-manage/published/${cId}`,
        )
        if (eRes.data && eRes.data.length > 0) {
          const className =
            regs.find((r) => (r.class?.id || r.class_id) === cId)?.class?.name || 'Lớp học'
          exams.push(...eRes.data.map((e) => ({ ...e, className })))
        }
      } catch (err) {}
    }
    upcomingExams.value = exams.slice(0, 3)
  } catch (err) {
    console.error('Failed to load student dashboard data:', err)
  }
  loadingStudent.value = false
}

onMounted(() => {
  if (isStudent.value) loadStudentData()
})
</script>

<template>
  <pv-toast />
  <div class="dashboard">
    <!-- Breadcrumb -->
    <div class="breadcrumb">Tổng quan / <span>Bảng điều khiển</span></div>

    <!-- Header Banner -->
    <div class="welcome-banner mb-xl">
      <div class="welcome-banner-content">
        <h1 class="welcome-title">Chào mừng trở lại, {{ authStore.profile?.fullName }} </h1>
        <div class="welcome-subtitle">
          {{
            isStudent
              ? 'Dưới đây là các thông tin tổng quan về học tập của bạn. Chúc bạn học tập tốt!'
              : 'Xem thông tin hồ sơ, quản lý nghiệp vụ và các truy cập nhanh bên dưới.'
          }}
        </div>
      </div>
      <!-- Decorative background circles -->
      <div class="banner-circle banner-circle-1"></div>
      <div class="banner-circle banner-circle-2"></div>
    </div>

    <!-- ============================================== -->
    <!-- DASHBOARD DÀNH CHO SINH VIÊN -->
    <!-- ============================================== -->
    <div v-if="isStudent" class="student-dashboard">
      <div v-if="loadingStudent" class="loading-center">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #6b7280"></i>
      </div>
      <template v-else>
        <!-- 3 thẻ thống kê nhanh -->
        <div class="stats-row mb-xl">
          <div class="lms-card stat-card">
            <div class="stat-icon-wrapper bg-blue-100 text-blue-600">
              <i class="pi pi-book"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ registeredCount }}</div>
              <div class="stat-label">Lớp đã đăng ký</div>
            </div>
          </div>
          <div class="lms-card stat-card">
            <div class="stat-icon-wrapper bg-purple-100 text-purple-600">
              <i class="pi pi-clock"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ upcomingExams.length }}</div>
              <div class="stat-label">Bài thi đang mở</div>
            </div>
          </div>
          <div class="lms-card stat-card">
            <div class="stat-icon-wrapper bg-green-100 text-green-600">
              <i class="pi pi-chart-line"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ gpaDisplay }}</div>
              <div class="stat-label">Điểm GPA (Hệ 10 / Hệ 4)</div>
            </div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="main-column">
            <!-- Widget 0: Lớp học của tôi -->
            <div class="lms-card mb-xl">
              <div class="card-header-flex">
                <h3 class="card-title">
                  <i class="pi pi-bookmark-fill text-purple-600 mr-2"></i> Lớp học của tôi
                </h3>
                <RouterLink to="/my-classes" class="link-more">Xem tất cả</RouterLink>
              </div>

              <div
                v-if="myRegisteredClasses.length === 0"
                class="text-gray-500 py-6 text-center text-sm"
              >
                Bạn chưa đăng ký lớp học nào. Hãy xem danh sách đăng ký ở dưới!
              </div>

              <div v-else class="my-classes-list">
                <div
                  v-for="cls in myRegisteredClasses.slice(0, 3)"
                  :key="cls.id"
                  class="my-class-row"
                  @click="viewLessons(cls)"
                >
                  <div class="my-class-info">
                    <span class="my-class-code">{{ cls.subject?.code }}</span>
                    <strong class="my-class-name">{{ cls.name }}</strong>
                    <span class="my-class-teacher"
                      >GV:
                      {{
                        cls.instructor?.fullName || cls.instructor?.full_name || 'Chưa phân công'
                      }}</span
                    >
                  </div>
                  <button class="btn-learn"><i class="pi pi-play mr-1"></i> Vào học</button>
                </div>
              </div>
            </div>

            <!-- Widget 1: Lớp học gợi ý đăng ký -->
            <div class="lms-card mb-xl">
              <div class="card-header-flex">
                <h3 class="card-title">
                  <i class="pi pi-bell text-blue-600 mr-2"></i> Lớp học đang mở đăng ký
                </h3>
                <RouterLink to="/registration" class="link-more">Xem tất cả</RouterLink>
              </div>

              <div
                v-if="availableClasses.length === 0"
                class="text-gray-500 py-4 text-center text-sm"
              >
                Không có lớp mới nào đang mở đăng ký.
              </div>

              <div
                v-for="(cls, idx) in availableClasses"
                :key="cls.id"
                class="notification-item"
                :class="{ 'no-border-bottom': idx === availableClasses.length - 1 }"
              >
                <div class="notif-content">
                  <div class="notif-title">
                    {{ cls.name || cls.subject?.name || cls.subject?.code }}
                  </div>
                  <div class="notif-desc">
                    <i class="pi pi-calendar mr-1"></i> {{ cls.schedule || 'Chưa xếp lịch' }} &nbsp;
                    | &nbsp; <i class="pi pi-user mr-1"></i>
                    {{ cls.instructor?.fullName || cls.instructor?.full_name || 'Chưa phân công' }}
                  </div>
                </div>
                <div class="notif-action text-right">
                  <div
                    class="text-sm font-semibold mb-2"
                    :class="
                      (cls.remainingSlots || cls.remaining_slots || 0) < 10
                        ? 'text-orange-600'
                        : 'text-green-600'
                    "
                  >
                    Còn: {{ cls.remainingSlots || cls.remaining_slots || 0 }} slot
                  </div>
                  <RouterLink to="/registration" class="btn-primary-small">Đăng ký</RouterLink>
                </div>
              </div>
            </div>

            <!-- Widget 2: Bài thi sắp tới -->
            <div class="lms-card">
              <div class="card-header-flex">
                <h3 class="card-title">
                  <i class="pi pi-pencil text-purple-600 mr-2"></i> Bài thi đang mở
                </h3>
                <RouterLink to="/exam" class="link-more">Đến trang Khảo thí</RouterLink>
              </div>

              <div v-if="upcomingExams.length === 0" class="text-gray-500 py-4 text-center text-sm">
                Bạn chưa có bài kiểm tra nào sắp diễn ra.
              </div>

              <div v-for="e in upcomingExams" :key="e.id" class="exam-item">
                <div class="exam-date">
                  <span class="exam-day">Đang mở</span>
                  <span class="exam-time">{{ e.duration_minutes }}p</span>
                </div>
                <div class="exam-info">
                  <div class="exam-name">{{ e.title }}</div>
                  <div class="exam-rules">
                    <i class="pi pi-info-circle"></i> {{ e.className }} (Bắt buộc Full-screen)
                  </div>
                </div>
                <div class="exam-action">
                  <RouterLink to="/exam" class="btn-purple-small">Vào phòng thi</RouterLink>
                </div>
              </div>
            </div>
          </div>

          <!-- Cột Profile (Dùng chung) -->
          <div class="side-column">
            <div class="lms-card profile-card">
              <div class="profile-avatar-container" @click="triggerAvatarUpload" :class="{ uploading: uploadingAvatar }">
                <img v-if="authStore.profile?.avatarUrl" :src="authStore.profile?.avatarUrl" class="profile-avatar-img" />
                <div v-else class="profile-avatar"><i class="pi pi-user"></i></div>
                <div class="avatar-overlay">
                  <i v-if="uploadingAvatar" class="pi pi-spin pi-spinner"></i>
                  <i v-else class="pi pi-camera"></i>
                </div>
              </div>
              <input type="file" accept="image/*" ref="fileInput" hidden @change="handleAvatarChange" />
              <h3 class="profile-name">{{ authStore.profile?.fullName }}</h3>
              <div v-if="authStore.profile?.mssv" class="profile-mssv">{{ authStore.profile?.mssv }}</div>
              <span class="lms-tag lms-tag-primary profile-role">{{ authStore.displayRole }}</span>
              <div class="profile-divider"></div>
              <div class="profile-detail">
                <div class="detail-row">
                  <span class="detail-label">Khoa</span>
                  <span class="detail-value">CNTT</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Trạng thái</span>
                  <span class="lms-tag lms-tag-success">Đang học</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ============================================== -->
    <!-- DASHBOARD DÀNH CHO ADMIN / GIẢNG VIÊN -->
    <!-- ============================================== -->
    <div v-else class="dashboard-grid">
      <div class="main-column">
        <!-- Stats Row -->
        <div class="stats-row">
          <div
            v-for="(stat, index) in statsCards"
            :key="index"
            class="lms-card stat-card"
            :class="{ 'stat-card-primary': stat.primary }"
          >
            <div class="stat-icon-wrapper"><i :class="stat.icon"></i></div>
            <div class="stat-content">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">
                {{ stat.label }}
                <div v-if="stat.label === 'Vai trò hiện tại' && authStore.profile?.department" class="stat-dept">
                  {{ authStore.profile.department }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quyền hạn -->
        <div class="lms-card mt-lg permissions-card">
          <h3 class="card-title">Phạm vi quyền hạn</h3>
          <p class="card-text">
            {{ rankDescription[authStore.profile?.rank || 10] }}
            <span v-if="authStore.profile?.role === 'TRUONG_BO_MON' && authStore.profile?.department" class="text-purple-600 font-semibold">
              (Khoa quản lý: {{ authStore.profile.department }})
            </span>
          </p>
        </div>

        <!-- Quick actions -->
        <div v-if="subjectLink !== '/dashboard' || classLink !== '/dashboard' || authStore.hasPermission('user_manage_staff') || departmentLink !== '/dashboard'" class="actions-section mt-xl">
          <h3 class="section-title">Khám phá tính năng</h3>
          <div class="actions-grid">
            <div v-if="authStore.hasPermission('user_manage_staff')" class="lms-card action-card">
              <div class="action-icon-wrapper green"><i class="pi pi-users"></i></div>
              <div class="action-content">
                <span class="action-label">Quản lý người dùng</span>
                <span class="action-desc">Tạo mới, phân quyền và khóa/mở khóa tài khoản nhân sự</span>
              </div>
            </div>

            <div v-if="subjectLink !== '/dashboard' || departmentLink !== '/dashboard'" class="lms-card action-card">
              <div class="action-icon-wrapper blue"><i class="pi pi-book"></i></div>
              <div class="action-content">
                <span class="action-label">Quản lý môn học</span>
                <span class="action-desc">Đề xuất môn học, phê duyệt học phần và phân công môn học bộ môn</span>
              </div>
            </div>

            <div v-if="classLink !== '/dashboard'" class="lms-card action-card">
              <div class="action-icon-wrapper purple"><i class="pi pi-sitemap"></i></div>
              <div class="action-content">
                <span class="action-label">Quản lý lớp học</span>
                <span class="action-desc">Quản lý và phân công lớp học</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột phụ bên phải -->
      <div class="side-column">
        <div class="lms-card profile-card">
          <div class="profile-avatar-container" @click="triggerAvatarUpload" :class="{ uploading: uploadingAvatar }">
            <img v-if="authStore.profile?.avatarUrl" :src="authStore.profile?.avatarUrl" class="profile-avatar-img" />
            <div v-else class="profile-avatar"><i class="pi pi-user"></i></div>
            <div class="avatar-overlay">
              <i v-if="uploadingAvatar" class="pi pi-spin pi-spinner"></i>
              <i v-else class="pi pi-camera"></i>
            </div>
          </div>
          <input type="file" accept="image/*" ref="fileInput" hidden @change="handleAvatarChange" />
          <h3 class="profile-name">{{ authStore.profile?.fullName }}</h3>
          <div v-if="authStore.profile?.mssv" class="profile-mssv">{{ authStore.profile?.mssv }}</div>
          <span class="lms-tag lms-tag-primary profile-role" :style="{ marginBottom: authStore.profile?.department ? '0.5rem' : '1.5rem' }">
            {{ authStore.displayRole }}
          </span>
          <div v-if="authStore.profile?.department" class="profile-dept-badge">
            <i class="pi pi-building mr-1 text-purple-600"></i>
            <span>{{ authStore.profile.department }}</span>
          </div>
          <div class="profile-divider"></div>
          <div class="profile-detail">
            <div v-if="authStore.profile?.department" class="detail-row">
              <span class="detail-label">Khoa quản lý</span>
              <span class="detail-value text-purple-600 font-semibold text-right">{{ authStore.profile.department }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ngày tham gia</span>
              <span class="detail-value">Hôm nay</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Trạng thái</span>
              <span class="lms-tag lms-tag-success">Hoạt động</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal xem bài giảng bài học cho Sinh viên -->
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
            <i
              class="pi pi-spin pi-spinner spinner-primary"
              style="font-size: 2rem; color: var(--lms-primary)"
            ></i>
            <span style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280"
              >Đang tải danh sách bài học...</span
            >
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
                  <template v-if="parseLessonContent(l.content).youtubeId && parseLessonContent(l.content).files && parseLessonContent(l.content).files.length > 0">
                    <span class="badge-mixed ml-2">
                      <i class="pi pi-clone mr-1"></i>Video + Tài liệu
                    </span>
                  </template>
                  <template v-else-if="parseLessonContent(l.content).youtubeId">
                    <span class="badge-video ml-2">
                      <i class="pi pi-video mr-1"></i>Video
                    </span>
                  </template>
                  <template v-else-if="parseLessonContent(l.content).type === 'doc'">
                    <span class="badge-doc ml-2">
                      <i class="pi pi-file mr-1"></i>Tài liệu
                    </span>
                  </template>
                  <template v-else-if="parseLessonContent(l.content).files && parseLessonContent(l.content).files.length > 0">
                    <span class="ml-2" :class="parseLessonContent(l.content).files[0].fileExt === 'docx' ? 'badge-word' : 'badge-pdf'">
                      <i :class="parseLessonContent(l.content).files[0].fileExt === 'docx' ? 'pi pi-file-word mr-1' : 'pi pi-file-pdf mr-1'"></i>
                      {{ parseLessonContent(l.content).files[0].fileExt === 'docx' ? 'Word' : 'PDF' }}
                      <span v-if="parseLessonContent(l.content).files.length > 1"> (+{{ parseLessonContent(l.content).files.length - 1 }})</span>
                    </span>
                  </template>
                </div>
                <i
                  class="pi"
                  :class="
                    expandedStudentLessons.includes(l.id)
                      ? 'pi-chevron-up text-purple-600'
                      : 'pi-chevron-down'
                  "
                ></i>
              </div>

              <div v-if="expandedStudentLessons.includes(l.id)" class="student-lesson-body">
                <!-- Video player -->
                <div v-if="parseLessonContent(l.content).youtubeId" class="student-video-wrapper mb-3">
                  <iframe :src="'https://www.youtube.com/embed/' + parseLessonContent(l.content).youtubeId" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;" allowfullscreen></iframe>
                </div>
                <div v-if="parseLessonContent(l.content).youtubeId && parseLessonContent(l.content).videoNote" class="video-note mb-3" style="background: #fdf2f8; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem; color: #db2777; border-left: 4px solid #ec4899; font-weight: 500; text-align: left;">
                  <i class="pi pi-info-circle mr-1"></i> Ghi chú video: {{ parseLessonContent(l.content).videoNote }}
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
                  </div>
                </div>

                <!-- Generic file content area (PDF & DOCX) -->
                <div v-if="parseLessonContent(l.content).files && parseLessonContent(l.content).files.length > 0" class="student-pdf-wrapper mb-3" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; border: 0; background: transparent; box-shadow: none; padding: 0;">
                  <div v-for="(file, idx) in parseLessonContent(l.content).files" :key="idx" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.9rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <span>Tài liệu {{ idx + 1 }}: {{ file.fileName }}</span>
                      <a v-if="file.fileExt === 'pdf'" :href="file.fileUrl" :download="file.fileName" target="_blank" class="btn-pdf-download text-center no-underline" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 0.35rem 0.75rem; font-size: 0.75rem;">
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
                <div v-if="parseLessonContent(l.content).description" class="student-lesson-desc">
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
.dashboard {
  width: 100%;
  animation: fadeIn 0.3s ease-out;
}
.breadcrumb {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
}
.breadcrumb span {
  color: #111827;
  font-weight: 500;
}
.page-header {
  margin-bottom: 2rem;
}
.page-title {
  margin-bottom: 4px;
  font-weight: 600;
  font-size: 1.75rem;
  color: #111827;
}
.page-subtitle {
  color: #6b7280;
  font-size: 0.95rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
}
.mb-xl {
  margin-bottom: 2rem;
}
.mt-lg {
  margin-top: 1.5rem;
}
.mt-xl {
  margin-top: 2rem;
}
.mr-2 {
  margin-right: 0.5rem;
}
.mr-1 {
  margin-right: 0.25rem;
}
.text-right {
  text-align: right;
}

/* Colors */
.text-blue-600 {
  color: #2563eb;
}
.bg-blue-100 {
  background: #dbeafe;
}
.text-purple-600 {
  color: var(--lms-primary);
}
.bg-purple-100 {
  background: var(--lms-primary-light);
}
.text-green-600 {
  color: #166534;
}
.bg-green-100 {
  background: #dcfce7;
}
.text-orange-600 {
  color: #ea580c;
}

/* Card System */
.lms-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
}
.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: #f3f4f6;
  color: #4b5563;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.2;
  margin-bottom: 2px;
}
.stat-label {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}
.stat-dept {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--lms-primary);
  margin-top: 4px;
}
.profile-dept-badge {
  display: inline-flex;
  align-items: center;
  background: var(--lms-primary-light);
  border: 1px solid #c7d2fe;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--lms-primary);
  margin-bottom: 1.5rem;
}

/* Dashboard Widgets */
.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}
.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
}
.link-more {
  font-size: 0.85rem;
  color: #2563eb;
  font-weight: 500;
  text-decoration: none;
}
.link-more:hover {
  text-decoration: underline;
}

/* Notification Items */
.notification-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px dashed #e5e7eb;
}
.no-border-bottom {
  border-bottom: none;
  padding-bottom: 0;
}
.notif-title {
  font-weight: 600;
  color: #111827;
  font-size: 1.05rem;
  margin-bottom: 0.25rem;
}
.notif-desc {
  font-size: 0.85rem;
  color: #6b7280;
  display: flex;
  align-items: center;
}
.btn-primary-small {
  background: #111827;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  display: inline-block;
  text-decoration: none;
  transition: background 0.2s;
}
.btn-primary-small:hover {
  background: #374151;
}

/* Exam Item */
.exam-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #f3f4f6;
}
.exam-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 80px;
}
.exam-day {
  font-size: 0.75rem;
  font-weight: 600;
  color: #dc2626;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.exam-time {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}
.exam-info {
  flex: 1;
}
.exam-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: #111827;
  margin-bottom: 0.25rem;
}
.exam-rules {
  font-size: 0.85rem;
  color: #ea580c;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.btn-purple-small {
  background: var(--lms-primary);
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
}
.btn-purple-small:hover {
  background: var(--lms-primary-hover);
}

/* Profile Card */
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.profile-avatar-container {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 1rem;
  cursor: pointer;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 50%;
}
.profile-avatar-container:hover .avatar-overlay {
  opacity: 1;
}
.profile-avatar-container.uploading .avatar-overlay {
  opacity: 1;
  background: rgba(0, 0, 0, 0.6);
}
.profile-avatar {
  width: 100%;
  height: 100%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #9ca3af;
}
.profile-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #111827;
}
.profile-mssv {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 0.5rem;
}
.profile-role {
  margin-bottom: 1.5rem;
}
.profile-divider {
  width: 100%;
  height: 1px;
  background: #e5e7eb;
  margin-bottom: 1rem;
}
.profile-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}
.detail-label {
  color: #6b7280;
}
.detail-value {
  color: #111827;
  font-weight: 500;
}
.lms-tag {
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.lms-tag-primary {
  background: #dbeafe;
  color: #1e40af;
}
.lms-tag-success {
  background: #dcfce7;
  color: #166534;
}

/* Actions (Admin) */
.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #111827;
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.action-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
  padding: 1.25rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
  border: 1px solid #e5e7eb;
}

.action-card:hover {
  border-color: #cbd5e1;
  background-color: #f8fafc;
}

.action-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}
.action-icon-wrapper.blue {
  background: #e0f2fe;
  color: #0284c7;
}
.action-icon-wrapper.purple {
  background: var(--lms-primary-light);
  color: var(--lms-primary);
}
.action-icon-wrapper.green {
  background: #dcfce7;
  color: #16a34a;
}
.action-icon-wrapper.orange {
  background: #ffedd5;
  color: #ea580c;
}
.action-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.action-label {
  font-weight: 600;
  color: #111827;
  font-size: 1rem;
  margin-bottom: 2px;
}
.action-desc {
  font-size: 0.85rem;
  color: #6b7280;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
/* Student Classes list style */
.my-classes-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.my-class-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
}
.my-class-row:hover {
  border-color: var(--lms-primary);
  background: #fbfbfe;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.05);
}
.my-class-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}
.my-class-code {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--lms-primary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.my-class-name {
  font-size: 0.95rem;
  color: #111827;
}
.my-class-teacher {
  font-size: 0.8rem;
  color: #6b7280;
}
.btn-learn {
  background: var(--lms-primary);
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: background 0.2s;
}
.btn-learn:hover {
  background: var(--lms-primary-hover);
}

/* Premium Modal Overlay & Content */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(17, 24, 39, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeInModal 0.25s ease-out;
}
.modal-content-premium {
  background: #fff;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  border-radius: 16px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  animation: slideUpModal 0.25s ease-out;
}
.modal-header {
  padding: 1.25rem 1.5rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.modal-header-info {
  display: flex;
  flex-direction: column;
}
.modal-pre-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.btn-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-close:hover {
  background: #f3f4f6;
  color: #111827;
}
.modal-body-premium {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Student Lessons viewer specific styles */
.loading-center-lessons {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #7c3aed;
}
.spinner-primary {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.empty-lessons {
  text-align: center;
  padding: 3rem 1.5rem;
  color: #6b7280;
}
.empty-lessons h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #111827;
}
.empty-lessons p {
  font-size: 0.875rem;
  color: #9ca3af;
}

.student-lessons-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.student-lesson-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.2s;
}
.student-lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #f9fafb;
  cursor: pointer;
}
.student-lesson-header:hover {
  background: #f3f4f6;
}
.student-lesson-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #111827;
}
.lesson-index {
  font-size: 0.8rem;
  background: #e5e7eb;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  color: #4b5563;
  font-weight: 700;
  margin-right: 0.75rem;
  text-transform: uppercase;
}
.lesson-name {
  font-size: 0.95rem;
}
.student-lesson-body {
  padding: 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.student-video-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.07);
  border: 1px solid #e5e7eb;
  background: #000;
}
.student-video-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.student-lesson-desc {
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.empty-desc {
  font-size: 0.85rem;
  color: #9ca3af;
  font-style: italic;
}
.badge-video {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: var(--lms-primary-light);
  color: var(--lms-primary);
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}
.badge-mixed {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: #dbeafe;
  color: #1e40af;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
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
.badge-pdf {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  background: #e0f2fe;
  color: #0369a1;
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
.docx-download-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  gap: 1rem;
}
.docx-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.docx-icon {
  font-size: 2.5rem;
  color: #1d4ed8;
}
.docx-details {
  display: flex;
  flex-direction: column;
  text-align: left;
}
.docx-filename {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  word-break: break-all;
}
.docx-hint {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.15rem;
}
.btn-download-docx {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #1d4ed8;
  color: #fff;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
}
.btn-download-docx:hover {
  background: #1e40af;
  box-shadow: 0 4px 6px -1px rgba(29, 78, 216, 0.2);
}
.student-pdf-wrapper {
  margin-top: 0.5rem;
  padding: 0.5rem;
}
.pdf-viewer-container {
  width: 100%;
  height: 600px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.pdf-iframe-viewer {
  width: 100%;
  height: 100%;
}
.student-doc-wrapper {
  margin-top: 0.5rem;
  padding: 0.5rem;
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
  border-left: 4px solid var(--lms-primary);
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

@keyframes fadeInModal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slideUpModal {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  .actions-grid {
    grid-template-columns: 1fr;
  }
}

/* Welcome Banner */
.welcome-banner {
  background: #ffffff;
  border: 1px solid var(--lms-gray-200);
  border-radius: 16px;
  padding: 2.25rem 2rem;
  color: var(--lms-gray-800);
  position: relative;
  overflow: hidden;
  box-shadow: var(--lms-shadow-sm);
  margin-bottom: 2rem;
}

.welcome-banner-content {
  position: relative;
  z-index: 2;
  max-width: 80%;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.025em;
  color: var(--lms-gray-900);
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--lms-gray-600);
  line-height: 1.5;
  font-weight: 400;
}

.banner-circle {
  display: none;
}

.banner-circle-1 {
  width: 300px;
  height: 300px;
  right: -50px;
  top: -100px;
}

.banner-circle-2 {
  width: 200px;
  height: 200px;
  right: 150px;
  bottom: -80px;
}

/* Stats Hover Effect */
.stat-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}

@media (max-width: 768px) {
  .welcome-banner {
    padding: 1.75rem 1.5rem;
  }
  .welcome-title {
    font-size: 1.5rem;
  }
  .welcome-banner-content {
    max-width: 100%;
  }
}
</style>
