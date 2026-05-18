<!-- ============================================================================
  AppSidebar.vue — Thanh điều hướng dọc (Sidebar)
  Trách nhiệm DUY NHẤT: Hiển thị menu dọc và thông tin user.
  ============================================================================ -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isCollapsed = ref(false)

/** Xử lý đăng xuất */
async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

/** Danh sách navigation links động theo quyền hạn */
const navLinks = computed(() => {
  const base = [
    { label: 'Tổng quan', to: '/dashboard', icon: 'pi pi-th-large' }
  ]

  // 1. Quản lý hệ thống (System & HR)
  if (authStore.hasPermission('user_manage_staff') || authStore.hasPermission('user_manage_senior')) {
    base.push({ label: 'Quản lý Nhân sự', to: '/admin/users', icon: 'pi pi-users' })
  }
  if (authStore.hasPermission('user_manage_senior') || authStore.hasPermission('user_manage_staff')) {
    base.push({ label: 'Phân quyền Nhân sự', to: '/admin/permissions', icon: 'pi pi-key' })
  }
  if (authStore.profile && authStore.profile.rank >= 90) {
    base.push({ label: 'Cấu hình trường', to: '/admin/configs', icon: 'pi pi-sliders-h' })
  }

  // 2. Quản lý Môn học
  if (authStore.hasPermission('subject_propose')) {
    base.push({ label: 'Đề xuất Môn học', to: '/subjects/propose', icon: 'pi pi-plus-circle' })
  }
  if (authStore.hasPermission('subject_approve')) {
    base.push({ label: 'Duyệt Môn học', to: '/admin/subjects', icon: 'pi pi-check-square' })
  }

  // 3. Quản lý Lớp học
  if (authStore.hasPermission('class_quantity_propose')) {
    base.push({ label: 'Đề xuất SL lớp', to: '/classes/propose', icon: 'pi pi-chart-bar' })
  }
  if (authStore.hasPermission('class_quantity_approve')) {
    base.push({ label: 'Duyệt SL lớp', to: '/admin/classes/approve', icon: 'pi pi-check-circle' })
  }
  if (authStore.hasPermission('class_create')) {
    base.push({ label: 'Tạo Lớp & Gán', to: '/admin/classes', icon: 'pi pi-sitemap' })
  }
  if (authStore.hasPermission('instructor_assign')) {
    base.push({ label: 'Phân công Giảng viên', to: '/admin/classes/assign', icon: 'pi pi-user-plus' })
  }

  // 4. Đào tạo & Khảo thí
  if (authStore.hasPermission('lesson_exam_manage')) {
    base.push({ label: 'Soạn Bài & Thi', to: '/lessons', icon: 'pi pi-book' })
  }

  // 5. Học viên
  if (authStore.hasPermission('class_register')) {
    base.push({ label: 'Đăng ký lớp học', to: '/registration', icon: 'pi pi-calendar-plus' })
  }
  if (authStore.hasPermission('exam_take')) {
    base.push({ label: 'Làm bài kiểm tra', to: '/exam', icon: 'pi pi-pencil' })
  }
  if (authStore.hasPermission('grade_view')) {
    base.push({ label: 'Xem bảng điểm', to: '/grades', icon: 'pi pi-chart-line' })
  }

  return base
})

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}
</script>


<template>
  <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <!-- Brand / User Info -->
    <div class="sidebar-header">
      <div class="brand-icon-wrapper" @click="router.push('/dashboard')">
        <i class="pi pi-graduation-cap brand-icon"></i>
      </div>
      <div class="user-info" v-if="!isCollapsed">
        <div class="brand-name">Hệ thống LMS</div>
        <div class="user-name">{{ authStore.profile?.fullName || 'Người dùng' }}</div>
        <div class="user-role">{{ authStore.displayRole }}</div>
      </div>
      <i 
        v-if="!isCollapsed" 
        class="pi pi-chevron-down header-chevron"
      ></i>
    </div>

    <!-- Navigation -->
    <div class="sidebar-menu">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="menu-item"
        :class="{ 'active': route.path.startsWith(link.to) }"
      >
        <i :class="link.icon" class="menu-icon"></i>
        <span v-if="!isCollapsed" class="menu-label">{{ link.label }}</span>
      </RouterLink>
    </div>

    <!-- Bottom Actions -->
    <div class="sidebar-footer">
      <div class="menu-item" @click="handleLogout">
        <i class="pi pi-sign-out menu-icon"></i>
        <span v-if="!isCollapsed" class="menu-label">Đăng xuất</span>
      </div>
      
      <div class="menu-item collapse-btn" @click="toggleSidebar">
        <i :class="isCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'" class="menu-icon"></i>
        <span v-if="!isCollapsed" class="menu-label">Thu gọn</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background-color: var(--lms-gray-50);
  border-right: var(--lms-border);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
  height: 100vh;
}

.sidebar.collapsed {
  width: 68px;
}

.sidebar-header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid transparent; /* To match structure but keep it clean */
  margin-bottom: 8px;
  cursor: pointer;
  border-radius: var(--lms-radius-lg);
}

.sidebar-header:hover {
  background-color: var(--lms-gray-100);
}

.brand-icon-wrapper {
  width: 36px;
  height: 36px;
  background-color: var(--lms-primary);
  border-radius: var(--lms-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-icon {
  color: var(--lms-white);
  font-size: 1.2rem;
}

.user-info {
  flex: 1;
  overflow: hidden;
}

.brand-name {
  font-weight: 600;
  color: var(--lms-gray-900);
  font-size: 0.95rem;
  line-height: 1.2;
}

.user-name {
  font-size: 0.8rem;
  color: var(--lms-gray-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  margin-top: 2px;
}

.user-role {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--lms-primary);
  margin-top: 2px;
  line-height: 1.2;
}

.header-chevron {
  font-size: 0.75rem;
  color: var(--lms-gray-400);
}

.sidebar-menu {
  flex: 1;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--lms-radius);
  color: var(--lms-gray-700);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
}

.menu-item:hover {
  background-color: var(--lms-gray-100);
  color: var(--lms-gray-900);
}

.menu-item.active {
  background-color: var(--lms-white);
  color: var(--lms-primary);
  font-weight: 500;
  box-shadow: var(--lms-shadow-sm);
  border: 1px solid var(--lms-gray-200);
}

.menu-item.active .menu-icon {
  color: var(--lms-primary);
}

.menu-icon {
  font-size: 1rem;
  color: var(--lms-gray-500);
  width: 20px;
  text-align: center;
}

.menu-label {
  font-size: 0.9rem;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px;
  border-top: var(--lms-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.collapse-btn {
  color: var(--lms-gray-500);
}

.collapse-btn:hover {
  color: var(--lms-gray-800);
}

/* Scrollbar styling for sidebar menu */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background-color: var(--lms-gray-300);
  border-radius: 4px;
}
</style>
