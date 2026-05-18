<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isStudent = computed(() => authStore.profile?.role === 'SINH_VIEN')

/** Thông tin thẻ thống kê cho Admin */
const statsCards = computed(() => [
  { label: 'Vai trò hiện tại', value: authStore.displayRole || 'Chưa cập nhật', icon: 'pi pi-shield', primary: true },
  { label: 'Cấp bậc (Rank)', value: String(authStore.profile?.rank || 0), icon: 'pi pi-star', primary: false },
  { label: 'Địa chỉ Email', value: authStore.profile?.email || '', icon: 'pi pi-envelope', primary: false }
])

/** Ánh xạ rank → mô tả quyền hạn */
const rankDescription: Record<number, string> = {
  100: 'Quản trị tối cao. Được bảo vệ tuyệt đối.',
  90: 'Kế thừa quyền vận hành. Phê duyệt môn học mới.',
  80: 'Tạo và phân quyền cho các role cấp dưới.',
  70: 'Quản lý chương trình đào tạo và lịch học.',
  60: 'Quản lý giảng viên và môn học trong bộ môn.',
  50: 'Giảng dạy và quản lý lớp học.',
  10: 'Đăng ký lớp học và tham gia thi cử.'
}
</script>

<template>
  <div class="dashboard">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      Tổng quan / <span>Bảng điều khiển</span>
    </div>

    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Chào mừng trở lại, {{ authStore.profile?.fullName }}</h1>
      <div class="page-subtitle">
        {{ isStudent ? 'Dưới đây là các lớp học đang mở và lịch thi sắp tới của bạn.' : 'Xem thông tin hồ sơ và các truy cập nhanh bên dưới.' }}
      </div>
    </div>

    <!-- ============================================== -->
    <!-- DASHBOARD DÀNH CHO SINH VIÊN -->
    <!-- ============================================== -->
    <div v-if="isStudent" class="student-dashboard">
      <!-- 3 thẻ thống kê nhanh -->
      <div class="stats-row mb-xl">
        <div class="lms-card stat-card">
          <div class="stat-icon-wrapper bg-blue-100 text-blue-600"><i class="pi pi-book"></i></div>
          <div class="stat-content">
            <div class="stat-value">2</div>
            <div class="stat-label">Lớp đang mở đăng ký</div>
          </div>
        </div>
        <div class="lms-card stat-card">
          <div class="stat-icon-wrapper bg-purple-100 text-purple-600"><i class="pi pi-clock"></i></div>
          <div class="stat-content">
            <div class="stat-value">1</div>
            <div class="stat-label">Bài thi tuần này</div>
          </div>
        </div>
        <div class="lms-card stat-card">
          <div class="stat-icon-wrapper bg-green-100 text-green-600"><i class="pi pi-chart-line"></i></div>
          <div class="stat-content">
            <div class="stat-value">8.5</div>
            <div class="stat-label">Điểm GPA hiện tại</div>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="main-column">
          
          <!-- Widget 1: Lớp học đang mở -->
          <div class="lms-card mb-xl">
            <div class="card-header-flex">
              <h3 class="card-title"><i class="pi pi-bell text-blue-600 mr-2"></i> Lớp học đang mở đăng ký</h3>
              <RouterLink to="/registration" class="link-more">Xem tất cả</RouterLink>
            </div>
            
            <div class="notification-item">
              <div class="notif-content">
                <div class="notif-title">INT101 - Trí tuệ nhân tạo</div>
                <div class="notif-desc"><i class="pi pi-calendar mr-1"></i> Thứ 2 (T1-3) &nbsp; | &nbsp; <i class="pi pi-user mr-1"></i> TS. Nguyễn Văn A</div>
              </div>
              <div class="notif-action text-right">
                <div class="text-sm font-semibold mb-2 text-orange-600">Sĩ số: 48/50</div>
                <RouterLink to="/registration" class="btn-primary-small">Tranh Slot Ngay</RouterLink>
              </div>
            </div>

            <div class="notification-item no-border-bottom">
              <div class="notif-content">
                <div class="notif-title">WEB202 - Lập trình Web</div>
                <div class="notif-desc"><i class="pi pi-calendar mr-1"></i> Thứ 6 (T4-6) &nbsp; | &nbsp; <i class="pi pi-user mr-1"></i> ThS. Lê C</div>
              </div>
              <div class="notif-action text-right">
                <div class="text-sm font-semibold mb-2 text-green-600">Sĩ số: 12/40</div>
                <RouterLink to="/registration" class="btn-primary-small">Đăng ký</RouterLink>
              </div>
            </div>
          </div>

          <!-- Widget 2: Bài thi sắp tới -->
          <div class="lms-card">
            <div class="card-header-flex">
              <h3 class="card-title"><i class="pi pi-pencil text-purple-600 mr-2"></i> Lịch thi sắp diễn ra</h3>
              <RouterLink to="/exam" class="link-more">Đến trang Khảo thí</RouterLink>
            </div>
            
            <div class="exam-item">
              <div class="exam-date">
                <span class="exam-day">Hôm nay</span>
                <span class="exam-time">14:00</span>
              </div>
              <div class="exam-info">
                <div class="exam-name">Thi Cuối Kỳ - Trí Tuệ Nhân Tạo</div>
                <div class="exam-rules"><i class="pi pi-exclamation-triangle"></i> Yêu cầu làm bài Full-screen (Anti-cheat)</div>
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
            <div class="profile-avatar"><i class="pi pi-user"></i></div>
            <h3 class="profile-name">{{ authStore.profile?.fullName }}</h3>
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
    </div>

    <!-- ============================================== -->
    <!-- DASHBOARD DÀNH CHO ADMIN / GIẢNG VIÊN -->
    <!-- ============================================== -->
    <div v-else class="dashboard-grid">
      <div class="main-column">
        <!-- Stats Row -->
        <div class="stats-row">
          <div v-for="(stat, index) in statsCards" :key="index" class="lms-card stat-card" :class="{ 'stat-card-primary': stat.primary }">
            <div class="stat-icon-wrapper"><i :class="stat.icon"></i></div>
            <div class="stat-content">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>

        <!-- Quyền hạn -->
        <div class="lms-card mt-lg permissions-card">
          <h3 class="card-title">Phạm vi quyền hạn</h3>
          <p class="card-text">{{ rankDescription[authStore.profile?.rank || 10] }}</p>
        </div>

        <!-- Quick actions -->
        <div class="actions-section mt-xl">
          <h3 class="section-title">Khám phá tính năng</h3>
          <div class="actions-grid">
            <RouterLink to="/admin/subjects" class="lms-card action-card">
              <div class="action-icon-wrapper blue"><i class="pi pi-book"></i></div>
              <div class="action-content">
                <span class="action-label">Duyệt môn học</span>
                <span class="action-desc">Quản lý chương trình đào tạo</span>
              </div>
              <i class="pi pi-chevron-right action-arrow"></i>
            </RouterLink>

            <RouterLink to="/admin/users" class="lms-card action-card">
              <div class="action-icon-wrapper purple"><i class="pi pi-users"></i></div>
              <div class="action-content">
                <span class="action-label">Quản lý Nhân sự</span>
                <span class="action-desc">Thêm/Xóa Giảng viên, NV</span>
              </div>
              <i class="pi pi-chevron-right action-arrow"></i>
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Cột phụ bên phải -->
      <div class="side-column">
        <div class="lms-card profile-card">
          <div class="profile-avatar"><i class="pi pi-user"></i></div>
          <h3 class="profile-name">{{ authStore.profile?.fullName }}</h3>
          <span class="lms-tag lms-tag-primary profile-role">{{ authStore.displayRole }}</span>
          <div class="profile-divider"></div>
          <div class="profile-detail">
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
  </div>
</template>

<style scoped>
.dashboard { width: 100%; animation: fadeIn 0.3s ease-out; }
.breadcrumb { font-size: 0.85rem; color: #6b7280; margin-bottom: 1.5rem; }
.breadcrumb span { color: #111827; font-weight: 500; }
.page-header { margin-bottom: 2rem; }
.page-title { margin-bottom: 4px; font-weight: 600; font-size: 1.75rem; color: #111827; }
.page-subtitle { color: #6b7280; font-size: 0.95rem; }

.dashboard-grid { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; }
.mb-xl { margin-bottom: 2rem; }
.mt-lg { margin-top: 1.5rem; }
.mt-xl { margin-top: 2rem; }
.mr-2 { margin-right: 0.5rem; }
.mr-1 { margin-right: 0.25rem; }
.text-right { text-align: right; }

/* Colors */
.text-blue-600 { color: #2563eb; } .bg-blue-100 { background: #dbeafe; }
.text-purple-600 { color: #9333ea; } .bg-purple-100 { background: #f3e8ff; }
.text-green-600 { color: #166534; } .bg-green-100 { background: #dcfce7; }
.text-orange-600 { color: #ea580c; }

/* Card System */
.lms-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 1.5rem;
}

/* Stats */
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.stat-card { display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem; }
.stat-icon-wrapper { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; background: #f3f4f6; color: #4b5563; }
.stat-value { font-size: 1.5rem; font-weight: 600; color: #111827; line-height: 1.2; margin-bottom: 2px; }
.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

/* Dashboard Widgets */
.card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f3f4f6; }
.card-title { font-size: 1.1rem; font-weight: 600; color: #111827; display: flex; align-items: center; }
.link-more { font-size: 0.85rem; color: #2563eb; font-weight: 500; text-decoration: none; }
.link-more:hover { text-decoration: underline; }

/* Notification Items */
.notification-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px dashed #e5e7eb; }
.no-border-bottom { border-bottom: none; padding-bottom: 0; }
.notif-title { font-weight: 600; color: #111827; font-size: 1.05rem; margin-bottom: 0.25rem; }
.notif-desc { font-size: 0.85rem; color: #6b7280; display: flex; align-items: center; }
.btn-primary-small { background: #111827; color: #fff; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500; display: inline-block; text-decoration: none; transition: background 0.2s; }
.btn-primary-small:hover { background: #374151; }

/* Exam Item */
.exam-item { display: flex; align-items: center; gap: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
.exam-date { display: flex; flex-direction: column; align-items: center; background: #fff; padding: 0.75rem 1rem; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; min-width: 80px; }
.exam-day { font-size: 0.75rem; font-weight: 600; color: #dc2626; text-transform: uppercase; margin-bottom: 0.25rem; }
.exam-time { font-size: 1.25rem; font-weight: 700; color: #111827; }
.exam-info { flex: 1; }
.exam-name { font-weight: 600; font-size: 1.1rem; color: #111827; margin-bottom: 0.25rem; }
.exam-rules { font-size: 0.85rem; color: #ea580c; display: flex; align-items: center; gap: 0.35rem; }
.btn-purple-small { background: #7c3aed; color: #fff; padding: 0.6rem 1.25rem; border-radius: 6px; font-size: 0.9rem; font-weight: 500; text-decoration: none; transition: background 0.2s; }
.btn-purple-small:hover { background: #6d28d9; }

/* Profile Card */
.profile-card { display: flex; flex-direction: column; align-items: center; text-align: center; }
.profile-avatar { width: 80px; height: 80px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #9ca3af; margin-bottom: 1rem; border: 4px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.profile-name { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem; color: #111827; }
.profile-role { margin-bottom: 1.5rem; }
.profile-divider { width: 100%; height: 1px; background: #e5e7eb; margin-bottom: 1rem; }
.profile-detail { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
.detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
.detail-label { color: #6b7280; }
.detail-value { color: #111827; font-weight: 500; }
.lms-tag { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.lms-tag-primary { background: #dbeafe; color: #1e40af; }
.lms-tag-success { background: #dcfce7; color: #166534; }

/* Actions (Admin) */
.section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #111827; }
.actions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.action-card { display: flex; align-items: center; gap: 1rem; text-decoration: none; padding: 1.25rem; transition: all 0.2s; }
.action-card:hover { border-color: #d1d5db; transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.action-icon-wrapper { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
.action-icon-wrapper.blue { background: #e0f2fe; color: #0284c7; }
.action-icon-wrapper.purple { background: #f3e8ff; color: #9333ea; }
.action-content { flex: 1; display: flex; flex-direction: column; }
.action-label { font-weight: 600; color: #111827; font-size: 1rem; margin-bottom: 2px; }
.action-desc { font-size: 0.85rem; color: #6b7280; }
.action-arrow { color: #9ca3af; transition: transform 0.2s; }
.action-card:hover .action-arrow { color: #2563eb; transform: translateX(2px); }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1024px) { .dashboard-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .stats-row { grid-template-columns: 1fr; } .actions-grid { grid-template-columns: 1fr; } }
</style>
