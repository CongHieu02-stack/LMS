// ============================================================================
// composables/useUserPermissions.ts — Vue Composable (Tầng Controller)
// Trách nhiệm DUY NHẤT: Quản lý trạng thái, thực hiện logic so sánh mảng (SRP),
// gọi API và cung cấp dữ liệu sạch cho View. TUYỆT ĐỐI không chứa mã giao diện.
// ============================================================================

import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

// Định nghĩa các interface kiểu dữ liệu (Model Interface ở Frontend)
export interface Permission {
  id: number
  code: string
  name: string
  group_name: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  rank: number
  avatar_url?: string | null
}

export function useUserPermissions() {
  // ─── STATE (LỚP MODEL PHÍA FRONTEND) ───
  const profiles = ref<UserProfile[]>([])
  const selectedUserId = ref<string | null>(null)
  const permissions = ref<Permission[]>([])
  const roleDefaultPermissions = ref<number[]>([]) // Chứa danh sách ID quyền mặc định của vai trò
  const userCurrentPermissions = ref<number[]>([])  // Chứa danh sách ID quyền thực tế của User
  const selectedPermissionIds = ref<number[]>([])  // Chứa danh sách ID quyền đang tích trên UI
  
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  // ─── GETTERS / COMPUTED (LOGIC TÁCH BIỆT DÀNH CHO VIEW) ───

  // Lấy thông tin profile của User đang được chọn
  const selectedUserProfile = computed(() => {
    return profiles.value.find(p => p.id === selectedUserId.value) || null
  })

  // Nhóm danh mục quyền theo cột 'group_name' để hiển thị dạng Matrix Card ở View
  const groupedPermissions = computed(() => {
    const groups: Record<string, Permission[]> = {}
    permissions.value.forEach(perm => {
      let key = perm.group_name ? perm.group_name.trim() : ''
      // Chuẩn hóa tên nhóm "Phòng đào tạo" để tránh chia làm 2 card do khác biệt chữ hoa/thường
      if (key.toLowerCase() === '4. chức năng phòng đào tạo') {
        key = '4. Chức năng Phòng Đào Tạo'
      }
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push({
        ...perm,
        group_name: key
      })
    })
    return groups
  })

  // ─── ACTIONS / LOGIC NGHIỆP VỤ (CONTROLLER BUSINESS LOGIC) ───

  /**
   * Tải danh sách người dùng (Profiles) để Admin lựa chọn
   */
  async function fetchProfiles() {
    loading.value = true
    errorMessage.value = null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, rank, avatar_url')
        .order('rank', { ascending: false })

      if (error) throw error
      profiles.value = data || []
    } catch (err) {
      errorMessage.value = (err as Error).message || 'Không thể tải danh sách tài khoản.'
    } finally {
      loading.value = false
    }
  }

  /**
   * Tải danh mục tất cả quyền chức năng có trong hệ thống
   */
  async function fetchPermissions() {
    errorMessage.value = null
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, code, name, group_name')
        .order('id', { ascending: true })

      if (error) throw error
      permissions.value = data || []
    } catch (err) {
      errorMessage.value = (err as Error).message || 'Không thể tải danh mục quyền.'
    }
  }

  /**
   * Tải danh sách ID quyền mặc định của một vai trò gốc (Base Role)
   * @param role — Tên vai trò (ADMIN, HR, GIANG_VIEN, ...)
   */
  async function fetchRoleDefaultPermissions(role: string): Promise<number[]> {
    errorMessage.value = null
    try {
      const { data, error } = await supabase
        .from('role_default_permissions')
        .select('permission_id')
        .eq('role', role)

      if (error) throw error
      const ids = (data || []).map(item => Number(item.permission_id))
      roleDefaultPermissions.value = ids
      return ids
    } catch (err) {
      errorMessage.value = (err as Error).message || `Không thể tải quyền mặc định cho vai trò ${role}.`
      return []
    }
  }

  /**
   * Tải danh sách ID quyền tùy chỉnh thực tế của người dùng cụ thể
   * @param userId — UUID của user cần tải
   */
  async function fetchUserCurrentPermissions(userId: string): Promise<number[]> {
    errorMessage.value = null
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_id')
        .eq('user_id', userId)

      if (error) throw error
      const ids = (data || []).map(item => Number(item.permission_id))
      userCurrentPermissions.value = ids
      return ids
    } catch (err) {
      errorMessage.value = (err as Error).message || 'Không thể tải quyền tùy biến của người dùng.'
      return []
    }
  }

  /**
   * Khởi tạo trạng thái quyền cho một người dùng cụ thể (Được gọi từ View khi chọn User)
   * @param userId — UUID của user
   */
  async function initPermissionsForUser(userId: string) {
    if (!userId) return

    selectedUserId.value = userId
    loading.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      // 1. Tìm profile tương ứng của User
      const userProfile = profiles.value.find(p => p.id === userId)
      if (!userProfile) {
        throw new Error('Không tìm thấy thông tin hồ sơ của tài khoản này.')
      }

      // 2. Chạy tải quyền mặc định của vai trò gốc và quyền thực tế song song để tối ưu tốc độ
      const [defaultIds, currentIds] = await Promise.all([
        fetchRoleDefaultPermissions(userProfile.role),
        fetchUserCurrentPermissions(userId)
      ])

      // ─── THUẬT TOÁN ĐIỀN TRẠNG THÁI MẶC ĐỊNH CHO CHECKBOX (DEFAULT CHECKED) ───
      // Nếu người dùng chưa từng được phân quyền tùy chỉnh (danh sách currentIds rỗng),
      // hệ thống sẽ tự động lấy danh sách quyền mặc định của vai trò gốc gán vào checkboxes.
      // Ngược lại, nếu đã có quyền tùy chỉnh trong DB, ta nạp danh sách đó lên UI.
      if (currentIds.length === 0) {
        selectedPermissionIds.value = [...defaultIds]
      } else {
        selectedPermissionIds.value = [...currentIds]
      }
    } catch (err) {
      errorMessage.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  /**
   * Lưu quyền tùy chỉnh của người dùng xuống Database
   * @param userId — UUID người dùng nhận quyền
   * @param role — Vai trò gốc của người dùng đó (để kiểm tra ràng buộc vai trò gốc)
   * @param permissionIds — Mảng ID các quyền đã tích trên UI
   */
  async function saveUserPermissions(userId: string, role: string, permissionIds: number[]): Promise<boolean> {
    saving.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      // === THUẬT TOÁN KIỂM TRA MẢNG CLIENT-SIDE (SRP - NGHIỆP VỤ BẢO VỆ PHÍA CLIENT) ===
      // Mục tiêu: Đảm bảo người dùng phải giữ lại ít nhất một chức năng thuộc vai trò mặc định của họ.
      
      // Bước A: Lấy danh sách ID quyền mặc định của vai trò gốc đang được lưu ở ref `roleDefaultPermissions`
      const baseDefaultIds = roleDefaultPermissions.value;

      // Bước B: Lọc mảng để tìm các ID quyền thuộc vai trò gốc vẫn được giữ lại trong danh sách tích chọn mới
      // Dùng hàm `.filter()` để rà soát tất cả các phần tử trong mảng quyền mặc định.
      // Dùng hàm `.includes()` để kiểm tra xem phần tử đó có xuất hiện trong danh sách `permissionIds` được chọn hay không.
      const retainedDefaultPermissions = baseDefaultIds.filter(defaultId => 
        permissionIds.includes(defaultId)
      );

      // Bước C: Nếu mảng lọc có độ dài bằng 0 (tức là không giữ lại bất kỳ quyền mặc định nào của vai trò gốc)
      // Hệ thống chặn thao tác ngay tại client, hiển thị lỗi sớm để tránh tạo request dư thừa lên DB.
      if (retainedDefaultPermissions.length === 0) {
        errorMessage.value = 'Người dùng phải giữ ít nhất một chức năng thuộc vai trò mặc định của họ!'
        return false
      }

      // === GỌI TẦNG MODEL (SUPABASE SECURE RPC) ===
      // Khi client-side validation vượt qua, ta gọi hàm Transaction RPC ở PostgreSQL để ghi đè an toàn.
      const { data, error } = await supabase.rpc('save_user_custom_permissions', {
        target_user_id: userId,
        assigned_permission_ids: permissionIds
      })

      if (error) {
        // Nếu database ném Exception (bao gồm cả kiểm tra ràng buộc ở mức DB), bắt lỗi và hiển thị lên UI
        throw error
      }

      if (data) {
        successMessage.value = 'Cập nhật cấu hình phân quyền người dùng thành công!'
        // Cập nhật lại trạng thái quyền hiện tại trong store frontend
        userCurrentPermissions.value = [...permissionIds]
        return true
      }
      
      return false
    } catch (err) {
      errorMessage.value = (err as Error).message || 'Có lỗi xảy ra khi lưu quyền tùy biến.'
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Cập nhật danh sách checkboxes khi Admin bấm "Reset về mặc định"
   */
  function resetToDefault() {
    selectedPermissionIds.value = [...roleDefaultPermissions.value]
    successMessage.value = 'Đã khôi phục các quyền mặc định của vai trò gốc trên giao diện. Vui lòng bấm Cập nhật để lưu.'
    errorMessage.value = null
  }

  return {
    // Refs (State)
    profiles,
    selectedUserId,
    permissions,
    roleDefaultPermissions,
    userCurrentPermissions,
    selectedPermissionIds,
    loading,
    saving,
    errorMessage,
    successMessage,

    // Computeds (Getters sạch cho View)
    selectedUserProfile,
    groupedPermissions,

    // Methods (Actions/Controller Logic)
    fetchProfiles,
    fetchPermissions,
    initPermissionsForUser,
    saveUserPermissions,
    resetToDefault
  }
}
