// ============================================================================
// router/index.ts — Vue Router Configuration
// Trách nhiệm DUY NHẤT: Định nghĩa các routes và cấu hình navigation guards.
// ============================================================================

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import UserManagementView from '../views/UserManagementView.vue'
import SubjectApprovalView from '../views/SubjectApprovalView.vue'
import SchoolConfigView from '../views/SchoolConfigView.vue'
import UserPermissionEditor from '../views/admin/UserPermissionEditor.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true },
    },
    {
      path: '/update-password',
      name: 'update-password',
      component: () => import('@/views/UpdatePasswordView.vue'),
      meta: { isGuestLayout: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },

    // ---- ADMIN & HR ----
    {
      path: '/admin/users',
      name: 'user-management',
      component: UserManagementView,
      meta: { requiresAuth: true, requirePermission: 'user_manage_staff' },
    },
    {
      path: '/admin/permissions',
      name: 'user-permissions',
      component: UserPermissionEditor,
      meta: { requiresAuth: true, requirePermission: 'user_manage_senior' },
    },
    {
      path: '/admin/activity-logs',
      name: 'activity-logs',
      component: () => import('@/views/admin/ActivityLogsView.vue'),
      meta: { requiresAuth: true, minRank: 100 },
    },
    {
      path: '/admin/configs',
      name: 'school-config',
      component: SchoolConfigView,
      meta: { requiresAuth: true, minRank: 90 },
    },

    // ---- QUẢN LÝ MÔN HỌC ----
    {
      path: '/subjects/propose',
      name: 'subject-propose',
      component: () => import('@/views/SubjectProposeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'subject_propose' },
    },
    {
      path: '/admin/subjects',
      name: 'subject-approval',
      component: SubjectApprovalView,
      meta: { requiresAuth: true, requirePermission: 'subject_approve' },
    },
    {
      path: '/admin/subjects/list',
      name: 'subject-list',
      component: () => import('@/views/admin/SubjectListView.vue'),
      meta: { requiresAuth: true, requirePermission: 'subject_approve' },
    },

    // ---- QUẢN LÝ BỘ MÔN ----
    {
      path: '/admin/departments/add-subject',
      name: 'department-add-subject',
      component: () => import('@/views/admin/DepartmentAddSubjectView.vue'),
      meta: { requiresAuth: true, requirePermission: 'department_manage' },
    },
    {
      path: '/admin/departments/approve',
      name: 'department-approve',
      component: () => import('@/views/admin/DepartmentApproveView.vue'),
      meta: { requiresAuth: true, requirePermission: 'department_manage' },
    },

    // ---- QUẢN LÝ LỚP HỌC ----
    {
      path: '/classes/propose',
      name: 'class-propose',
      component: () => import('@/views/ClassProposalView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_quantity_propose' },
    },
    {
      path: '/admin/classes/approve',
      name: 'class-approve',
      component: () => import('@/views/admin/ClassApprovalView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_quantity_approve' },
    },
    {
      path: '/admin/classes',
      name: 'class-management',
      component: () => import('@/views/admin/ClassManagementView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_create' },
    },
    {
      path: '/admin/classes/search',
      name: 'class-search',
      component: () => import('@/views/admin/ClassSearchView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_create' },
    },
    {
      path: '/admin/classes/assign',
      name: 'instructor-assign',
      component: () => import('@/views/admin/InstructorAssignView.vue'),
      meta: { requiresAuth: true, requirePermission: 'instructor_assign' },
    },

    // ---- ĐÀO TẠO & KHẢO THÍ ----
    {
      path: '/lessons',
      name: 'lesson-manage',
      component: () => import('@/views/LessonExamManageView.vue'),
      meta: { requiresAuth: true, requirePermission: 'lesson_exam_manage' },
    },
    {
      path: '/exams',
      name: 'exam-manage',
      component: () => import('@/views/LessonExamManageView.vue'),
      meta: { requiresAuth: true, requirePermission: 'lesson_exam_manage' },
    },

    // ---- PHÂN HỆ SINH VIÊN ----
    {
      path: '/registration',
      name: 'registration',
      component: () => import('@/views/RegistrationView.vue'),
      meta: { requiresAuth: true, requirePermission: 'class_register' },
    },
    {
      path: '/exam',
      name: 'exam-take',
      component: () => import('@/views/ExamTakeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'exam_take' },
    },
    {
      path: '/grades',
      name: 'grades',
      component: () => import('@/views/GradeView.vue'),
      meta: { requiresAuth: true, requirePermission: 'grade_view' },
    },
    {
      path: '/timetable',
      name: 'timetable',
      component: () => import('@/views/TimetableView.vue'),
      meta: { requiresAuth: true, allowedRoles: ['SINH_VIEN', 'GIANG_VIEN'] },
    },
  ],
})

// ─── NAVIGATION GUARDS ───
router.beforeEach(async (to, _from) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isAuthenticated = !!session

  const authStore = useAuthStore()

  if (isAuthenticated && !authStore.profile) {
    await authStore.initialize()
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  } else if (to.meta.requiresGuest && isAuthenticated) {
    return { name: 'dashboard' }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'dashboard' }
  } else if (
    to.meta.requirePermission &&
    !authStore.hasPermission(to.meta.requirePermission as string) &&
    !authStore.hasPermission('user_manage_senior')
  ) {
    return { name: 'dashboard' }
  } else if (to.meta.minRank && (authStore.profile?.rank || 0) < (to.meta.minRank as number)) {
    return { name: 'dashboard' }
  } else if (
    to.meta.allowedRoles &&
    ! (to.meta.allowedRoles as string[]).includes(authStore.profile?.role || '')
  ) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
