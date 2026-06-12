<!-- ============================================================================
  AppSidebar.vue — Thanh điều hướng dọc (Sidebar) MVC & SRP
  Dạng Accordion phân tầng - Kết hợp với Giao diện Soft UI ban đầu
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

// ----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU (TypeScript Interface)
// ----------------------------------------------------------------------------
interface SubMenuItem {
  label: string
  to: string
  requiredPermission?: string | string[]
  studentOnly?: boolean
  allowedRoles?: string[]
}

interface MainMenuGroup {
  label: string
  icon: string
  isOpen: boolean
  items: SubMenuItem[]
}

// ----------------------------------------------------------------------------
// 2. KHỞI TẠO MẢNG DỮ LIỆU (Đúng 4 nhóm Use Case của Super Admin)
// ----------------------------------------------------------------------------
const menuGroups = ref<MainMenuGroup[]>([
  {
    label: 'Quản lý Người dùng',
    icon: 'pi pi-users',
    isOpen: false,
    items: [
      {
        label: 'Danh sách người dùng',
        to: '/admin/users',
        requiredPermission: ['user_manage_senior', 'user_manage_staff'],
      },
      {
        label: 'Phân quyền nhân sự',
        to: '/admin/permissions',
        requiredPermission: 'user_manage_senior',
      },
      {
        label: 'Lịch sử hoạt động',
        to: '/admin/activity-logs',
        requiredPermission: 'user_manage_senior',
      },
    ],
  },
  {
    label: 'Quản lý Môn học',
    icon: 'pi pi-book',
    isOpen: false,
    items: [
      {
        label: 'Đề xuất môn học mới',
        to: '/subjects/propose',
        requiredPermission: 'subject_propose',
      },
      {
        label: 'Danh sách & Khóa môn học ',
        to: '/admin/subjects/list',
        requiredPermission: 'subject_approve',
      },
      {
        label: 'Thêm môn học',
        to: '/admin/departments/add-subject',
        requiredPermission: 'subject_propose',
      },
      {
        label: 'Phê duyệt môn',
        to: '/admin/departments/approve',
        requiredPermission: 'subject_approve',
      },
    ],
  },
  {
    label: 'Quản lý Lớp học',
    icon: 'pi pi-sitemap',
    isOpen: false,
    items: [
      {
        label: 'Đề xuất mở lớp',
        to: '/classes/propose',
        requiredPermission: 'class_quantity_propose',
      },
      {
        label: 'Phê duyệt lớp (Duyệt/Từ chối)',
        to: '/admin/classes/approve',
        requiredPermission: 'class_quantity_approve',
      },
      {
        label: 'Phân công giảng viên',
        to: '/admin/classes/assign',
        requiredPermission: 'instructor_assign',
      },
      {
        label: 'Bài học',
        to: '/lessons',
        requiredPermission: 'lesson_exam_manage',
      },
      {
        label: 'Bài kiểm tra',
        to: '/exams',
        requiredPermission: 'lesson_exam_manage',
      },
      {
        label: 'Tạo lớp học (Khung)',
        to: '/admin/classes',
        requiredPermission: ['class_create', 'class_quantity_approve'],
      },
      {
        label: 'Tra cứu lớp (Bộ lọc)',
        to: '/admin/classes/search',
        requiredPermission: 'class_view',
      },
    ],
  },
])

const standaloneMenus = ref<(SubMenuItem & { icon?: string })[]>([
  { label: 'Tổng quan', to: '/dashboard', icon: 'pi pi-th-large' },
  {
    label: 'Thời khoá biểu',
    to: '/timetable',
    icon: 'pi pi-calendar',
    allowedRoles: ['SINH_VIEN', 'GIANG_VIEN'],
  },
  {
    label: 'Đăng ký lớp học',
    to: '/registration',
    icon: 'pi pi-pencil',
    requiredPermission: 'class_register',
    studentOnly: true,
  },
  {
    label: 'Lớp học của tôi',
    to: '/my-classes',
    icon: 'pi pi-sitemap',
    requiredPermission: 'class_register',
    studentOnly: true,
  },
  {
    label: 'Bài thi của tôi',
    to: '/exam',
    icon: 'pi pi-file-edit',
    requiredPermission: 'exam_take',
    studentOnly: true,
  },
  {
    label: 'Bảng điểm',
    to: '/grades',
    icon: 'pi pi-chart-bar',
    requiredPermission: 'grade_view',
    studentOnly: true,
  },
])

// ----------------------------------------------------------------------------
// TÍNH TOÁN BỘ LỌC ĐỘNG DỰA TRÊN QUYỀN HẠN
// ----------------------------------------------------------------------------

// Lọc các chức năng độc lập
const filteredStandalone = computed(() => {
  return standaloneMenus.value
    .map((item) => {
      if (item.to === '/timetable' && authStore.profile?.role === 'GIANG_VIEN') {
        return { ...item, label: 'Lịch giảng dạy' }
      }
      return item
    })
    .filter((item) => {
      // Nếu là chức năng sinh viên, chỉ hiển thị nếu là vai trò SINH_VIEN hoặc được gán quyền trực tiếp
      if (item.studentOnly) {
        const isStudent = authStore.profile?.role === 'SINH_VIEN'
        const hasExplicitPermission =
          item.requiredPermission &&
          (Array.isArray(item.requiredPermission)
            ? item.requiredPermission.some((p) => authStore.profile?.permissions?.includes(p))
            : authStore.profile?.permissions?.includes(item.requiredPermission))

        if (!isStudent && !hasExplicitPermission) {
          return false
        }
      }
      if (item.allowedRoles && !item.allowedRoles.includes(authStore.profile?.role || '')) {
        return false
      }

      if (!item.requiredPermission) return true
      if (Array.isArray(item.requiredPermission)) {
        return item.requiredPermission.some((p) => authStore.hasPermission(p))
      }
      return authStore.hasPermission(item.requiredPermission)
    })
})

// Lọc các nhóm lớn và các mục con bên trong
const filteredMenuGroups = computed(() => {
  return menuGroups.value
    .map((group) => {
      // Lọc các items con bên trong nhóm
      const filteredItems = group.items.filter((item) => {
        if (item.allowedRoles && !item.allowedRoles.includes(authStore.profile?.role || '')) {
          return false
        }
        if (!item.requiredPermission) return true
        if (Array.isArray(item.requiredPermission)) {
          return item.requiredPermission.some((p) => authStore.hasPermission(p))
        }
        return authStore.hasPermission(item.requiredPermission)
      })

      // Trả về bản sao của group với danh sách con đã lọc
      return {
        ...group,
        items: filteredItems,
      }
    })
    .filter((group) => group.items.length > 0) // CHỈ giữ lại các nhóm có ít nhất 1 mục con hiển thị được
})

function isSubItemActive(subItem: SubMenuItem) {
  if (subItem.to.includes('?')) {
    return route.fullPath === subItem.to
  }
  if (route.fullPath.includes('?')) {
    return false
  }
  if (route.path === subItem.to) {
    return true
  }
  if (route.path.startsWith(subItem.to + '/')) {
    // Chỉ kích hoạt prefix match nếu không có menu con nào khác trùng khớp tuyệt đối với route hiện tại
    const hasExactSiblingMatch = menuGroups.value.some((group) =>
      group.items.some((item) => route.path === item.to),
    )
    return !hasExactSiblingMatch
  }
  return false
}

// ----------------------------------------------------------------------------
// 3. HÀM ĐIỀU KHIỂN LOGIC ĐÓNG/MỞ (ACCORDION TOGGLE)
// ----------------------------------------------------------------------------
function toggleGroup(targetGroup: MainMenuGroup) {
  const originalGroup = menuGroups.value.find((g) => g.label === targetGroup.label)
  if (originalGroup) {
    const wasOpen = originalGroup.isOpen
    // Đóng tất cả các nhóm khác (Accordion effect)
    menuGroups.value.forEach((g) => (g.isOpen = false))
    // Đảo ngược trạng thái của nhóm được click
    originalGroup.isOpen = !wasOpen
  }
}

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function handleSidebarClick() {
  if (isCollapsed.value) {
    isCollapsed.value = false
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getAvatarBgStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return {
    backgroundColor: `hsl(${h}, 60%, 90%)`,
    color: `hsl(${h}, 70%, 35%)`,
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }" @click="handleSidebarClick">
    <!-- Brand / User Info -->
    <div class="sidebar-header">
      <div class="brand-icon-wrapper" @click="router.push('/dashboard')" style="cursor: pointer;" title="Đi tới trang tổng quan">
        <i class="pi pi-graduation-cap brand-icon"></i>
      </div>
      <div class="user-info" v-if="!isCollapsed">
        <div class="brand-name">Hệ thống LMS</div>
        <div class="user-name-wrapper" style="display: flex; align-items: center; gap: 8px; margin-top: 4px; overflow: hidden; width: 100%;">
          <img v-if="authStore.profile?.avatarUrl" :src="authStore.profile?.avatarUrl" class="sidebar-avatar-img-small" alt="avatar" />
          <div v-else class="sidebar-avatar-placeholder-small" :style="getAvatarBgStyle(authStore.profile?.fullName || 'User')">
            {{ getInitials(authStore.profile?.fullName || 'User') }}
          </div>
          <div class="user-name" style="margin: 0; flex: 1;">{{ authStore.profile?.fullName || 'Người dùng' }}</div>
        </div>
        <div class="user-role">{{ authStore.displayRole }}</div>
      </div>
    </div>

    <!-- Navigation Menu -->
    <div class="sidebar-menu">
      <!-- DANH SÁCH MENU ĐỘC LẬP -->
      <RouterLink
        v-for="link in filteredStandalone"
        :key="link.to"
        :to="link.to"
        class="menu-item"
        :class="{
          active:
            route.path === link.to || (link.to !== '/dashboard' && route.path.startsWith(link.to)),
        }"
      >
        <i :class="link.icon || 'pi pi-circle-fill'" class="menu-icon"></i>
        <span v-if="!isCollapsed" class="menu-label">{{ link.label }}</span>
      </RouterLink>

      <!-- 4 NHÓM QUẢN LÝ CHÍNH (VÒNG LẶP TẦNG 1) -->
      <div v-for="group in filteredMenuGroups" :key="group.label" class="menu-group">
        <!-- Tiêu đề Nhóm (Click để mở) -->
        <div
          class="menu-group-header"
          :class="{ active: group.isOpen }"
          @click="toggleGroup(group)"
        >
          <div class="group-header-left">
            <i :class="group.icon" class="menu-icon"></i>
            <span v-if="!isCollapsed" class="menu-label group-title">{{ group.label }}</span>
          </div>
          <!-- Icon mũi tên trạng thái -->
          <i
            v-if="!isCollapsed"
            class="pi transition-transform chevron-icon"
            :class="group.isOpen ? 'pi-angle-down' : 'pi-angle-right'"
          ></i>
        </div>

        <!-- Danh sách mục con (VÒNG LẶP TẦNG 2) -->
        <div class="submenu-container" v-show="group.isOpen && !isCollapsed">
          <RouterLink
            v-for="subItem in group.items"
            :key="subItem.to"
            :to="subItem.to"
            class="submenu-item"
            :class="{
              'active-sub': isSubItemActive(subItem),
            }"
          >
            <!-- KHÔNG CÓ DẤU CHẤM HOẶC GẠCH ĐẦU DÒNG NỮA -->
            <span class="submenu-label">{{ subItem.label }}</span>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="sidebar-footer">
      <div class="menu-item" @click="handleLogout">
        <i class="pi pi-sign-out menu-icon"></i>
        <span v-if="!isCollapsed" class="menu-label">Đăng xuất</span>
      </div>

      <div class="menu-item collapse-btn" @click.stop="toggleSidebar">
        <i
          :class="isCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
          class="menu-icon"
        ></i>
        <span v-if="!isCollapsed" class="menu-label">Thu gọn</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* ============================================================================
   GIAO DIỆN MỀM MẠI, ĐƠN GIẢN NGUYÊN BẢN (FLAT DESIGN) KẾT HỢP ACCORDION
   ============================================================================ */

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
  border-bottom: 1px solid transparent;
  margin-bottom: 8px;
  cursor: default;
  border-radius: var(--lms-radius-lg);
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

/* Custom Scrollbar */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}
.sidebar-menu::-webkit-scrollbar-thumb {
  background-color: var(--lms-gray-300);
  border-radius: 4px;
}

/* CÁC THẺ MENU CHUNG (Bao gồm Độc lập, Group Header, Footer) */
.menu-item,
.menu-group-header {
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

.menu-item:hover,
.menu-group-header:hover {
  background-color: var(--lms-gray-100);
  color: var(--lms-gray-900);
}

/* Trạng thái Active cho Item đơn lẻ & Group đang mở */
.sidebar:not(.collapsed) .menu-item.active,
.sidebar:not(.collapsed) .menu-group-header.active {
  background-color: var(--lms-white);
  color: var(--lms-primary);
  font-weight: 500;
  box-shadow: var(--lms-shadow-sm);
  border: 1px solid var(--lms-gray-200);
}

.sidebar.collapsed .menu-item.active,
.sidebar.collapsed .menu-group-header.active {
  background-color: transparent !important;
  border: 1px solid transparent !important;
  box-shadow: none !important;
}

.menu-item.active .menu-icon,
.menu-group-header.active .menu-icon,
.menu-group-header.active .chevron-icon {
  color: var(--lms-primary);
}

.menu-group-header {
  justify-content: space-between;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-title {
  font-weight: 500;
}

.menu-icon {
  font-size: 1.1rem; /* Khớp icon size trong ảnh */
  color: var(--lms-gray-500);
  width: 20px;
  text-align: center;
}

.chevron-icon {
  font-size: 0.8rem;
  color: var(--lms-gray-500);
  transition: transform 0.2s;
}

.menu-label {
  font-size: 0.95rem;
  white-space: nowrap;
}

/* CONTAINER DANH SÁCH MỤC CON */
.submenu-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 40px; /* Thụt vào thật sâu tạo cấu trúc phân cấp, không dùng dot */
  margin-top: 4px;
  margin-bottom: 8px;
}

.submenu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--lms-radius);
  color: var(--lms-gray-600);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.submenu-item:hover {
  background-color: var(--lms-gray-100);
  color: var(--lms-gray-900);
}

/* Submenu Active */
.submenu-item.active-sub {
  color: var(--lms-primary);
  font-weight: 500;
  background-color: transparent;
}

/* FOOTER */
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

/* Sidebar Avatars */
.avatar-container-collapsed {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.sidebar-avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.sidebar-avatar-img-small {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.sidebar-avatar-placeholder-small {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.7rem;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
