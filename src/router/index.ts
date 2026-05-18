// ============================================================================
// router/index.ts — Vue Router Configuration
// Trách nhiệm DUY NHẤT: Định nghĩa các routes và cấu hình navigation guards.
// ============================================================================

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import RegistrationView from '../views/RegistrationView.vue'
import ExamView from '../views/ExamView.vue'
import UserManagementView from '../views/UserManagementView.vue'
import SubjectApprovalView from '../views/SubjectApprovalView.vue'
import SchoolConfigView from '../views/SchoolConfigView.vue'
import UserPermissionEditor from '../views/admin/UserPermissionEditor.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/registration',
      name: 'registration',
      component: RegistrationView,
      meta: { requiresAuth: true }
    },
    {
      path: '/exam',
      name: 'exam',
      component: ExamView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/users',
      name: 'user-management',
      component: UserManagementView,
      meta: { requiresAuth: true, requirePermission: 'user_manage_staff' }
    },
    {
      path: '/admin/permissions',
      name: 'user-permissions',
      component: UserPermissionEditor,
      meta: { requiresAuth: true, requirePermission: 'user_manage_senior' }
    },
    {
      path: '/admin/subjects',
      name: 'subject-approval',
      component: SubjectApprovalView,
      meta: { requiresAuth: true, requirePermission: 'subject_approve' }
    },
    {
      path: '/subjects/propose',
      name: 'subject-propose',
      component: () => import('@/views/SubjectProposeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'subject_propose' }
    },
    // ---- PHÂN HỆ SINH VIÊN ----
    {
      path: '/registration',
      name: 'registration',
      component: () => import('@/views/RegistrationView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_register' }
    },
    {
      path: '/exam',
      name: 'exam-take',
      component: () => import('@/views/ExamTakeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'exam_take' }
    },
    {
      path: '/grades',
      name: 'grades',
      component: () => import('@/views/GradeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'grade_view' }
    },
    // ---------------------------
    {
      path: '/admin/configs',
      name: 'school-config',
      component: SchoolConfigView,
      meta: { requiresAuth: true, minRank: 90 }
    }
  ]
})

// ─── NAVIGATION GUARDS ───
router.beforeEach(async (to, _from, next) => {
  // Lấy session từ Supabase trực tiếp
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthenticated = !!session

  const authStore = useAuthStore()

  // Nếu đã đăng nhập nhưng chưa có profile ở store, fetch ngay lập tức
  if (isAuthenticated && !authStore.profile) {
    await authStore.initialize()
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Nếu chưa đăng nhập mà vào trang bảo vệ → redirect login
    next({ name: 'login' })
  } else if (to.meta.requiresGuest && isAuthenticated) {
    // Nếu đã đăng nhập mà vào trang login → redirect dashboard
    next({ name: 'dashboard' })
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    // Yêu cầu quyền admin tối cao nhưng không phải
    next({ name: 'dashboard' })
  } else if (to.meta.requirePermission && !authStore.hasPermission(to.meta.requirePermission as string) && !authStore.hasPermission('user_manage_senior')) {
    // Không có quyền tĩnh nào khớp và không phải super_admin quản lý cấp cao
    next({ name: 'dashboard' })
  } else if (to.meta.minRank && (authStore.profile?.rank || 0) < (to.meta.minRank as number)) {
    // Yêu cầu rank tối thiểu nhưng không đủ
    next({ name: 'dashboard' })
  } else {
    // Hợp lệ, cho qua
    next()
  }
})

export default router

