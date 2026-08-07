export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'manager'
  | 'accountant'
  | 'security'
  | 'resident'
  | 'maintenance'

export const USER_ROLES: Record<UserRole, { label: string; labelMn: string; rank: number }> = {
  super_admin: { label: 'Super Admin', labelMn: 'Супер Админ', rank: 100 },
  org_admin: { label: 'Organization Admin', labelMn: 'СӨХ Админ', rank: 90 },
  manager: { label: 'Manager', labelMn: 'Менежер', rank: 70 },
  accountant: { label: 'Accountant', labelMn: 'Нягтлан', rank: 60 },
  security: { label: 'Security Guard', labelMn: 'Хамгаалалт', rank: 40 },
  maintenance: { label: 'Maintenance Staff', labelMn: 'Засварчин', rank: 30 },
  resident: { label: 'Resident', labelMn: 'Орон сууцчин', rank: 10 },
}

export type ApartmentStatus = 'occupied' | 'vacant' | 'maintenance'
export const APARTMENT_STATUS: Record<ApartmentStatus, { label: string; labelMn: string }> = {
  occupied: { label: 'Occupied', labelMn: 'Ашиглагдаж буй' },
  vacant: { label: 'Vacant', labelMn: 'Хоосон' },
  maintenance: { label: 'Maintenance', labelMn: 'Засварт' },
}

export type ResidentStatus = 'owner' | 'tenant' | 'inactive'
export const RESIDENT_STATUS: Record<ResidentStatus, { label: string; labelMn: string }> = {
  owner: { label: 'Owner', labelMn: 'Өмчлөгч' },
  tenant: { label: 'Tenant', labelMn: 'Түрээслэгч' },
  inactive: { label: 'Inactive', labelMn: 'Идэвхгүй' },
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; labelMn: string }> = {
  paid: { label: 'Paid', labelMn: 'Төлсөн' },
  pending: { label: 'Pending', labelMn: 'Хүлээгдэж буй' },
  overdue: { label: 'Overdue', labelMn: 'Хоцорсон' },
  cancelled: { label: 'Cancelled', labelMn: 'Цуцлагдсан' },
}

export type InvoiceType =
  | 'hoa_fee'
  | 'parking'
  | 'water'
  | 'electricity'
  | 'internet'
  | 'cleaning'
  | 'elevator'
  | 'repair_fund'
  | 'custom'
export const INVOICE_TYPE: Record<InvoiceType, { label: string; labelMn: string }> = {
  hoa_fee: { label: 'HOA Fee', labelMn: 'СӨХ төлбөр' },
  parking: { label: 'Parking', labelMn: 'Паркинг' },
  water: { label: 'Water', labelMn: 'Ус' },
  electricity: { label: 'Electricity', labelMn: 'Цахилгаан' },
  internet: { label: 'Internet', labelMn: 'Интернет' },
  cleaning: { label: 'Cleaning', labelMn: 'Цэвэрлэгээ' },
  elevator: { label: 'Elevator', labelMn: 'Шатгайн' },
  repair_fund: { label: 'Repair Fund', labelMn: 'Сангин сан' },
  custom: { label: 'Custom', labelMn: 'Өөр' },
}

export type ComplaintCategory =
  | 'cleaning'
  | 'noise'
  | 'parking'
  | 'elevator'
  | 'security'
  | 'water'
  | 'electricity'
  | 'other'
export const COMPLAINT_CATEGORY: Record<ComplaintCategory, { label: string; labelMn: string }> = {
  cleaning: { label: 'Cleaning', labelMn: 'Цэвэрлэгээ' },
  noise: { label: 'Noise', labelMn: 'Чимээ' },
  parking: { label: 'Parking', labelMn: 'Паркинг' },
  elevator: { label: 'Elevator', labelMn: 'Шатгайн' },
  security: { label: 'Security', labelMn: 'Хамгаалалт' },
  water: { label: 'Water', labelMn: 'Ус' },
  electricity: { label: 'Electricity', labelMn: 'Цахилгаан' },
  other: { label: 'Other', labelMn: 'Бусад' },
}

export type ComplaintStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
export const COMPLAINT_STATUS: Record<ComplaintStatus, { label: string; labelMn: string }> = {
  new: { label: 'New', labelMn: 'Шинэ' },
  assigned: { label: 'Assigned', labelMn: 'Хуваарилагдсан' },
  in_progress: { label: 'In Progress', labelMn: 'Хийгдэж буй' },
  resolved: { label: 'Resolved', labelMn: 'Шийдэгдсэн' },
  closed: { label: 'Closed', labelMn: 'Хаагдсан' },
}

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical'
export const WORK_ORDER_PRIORITY: Record<WorkOrderPriority, { label: string; labelMn: string }> = {
  low: { label: 'Low', labelMn: 'Бага' },
  medium: { label: 'Medium', labelMn: 'Дунд' },
  high: { label: 'High', labelMn: 'Өндөр' },
  critical: { label: 'Critical', labelMn: 'Яаралтай' },
}

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export const WORK_ORDER_STATUS: Record<WorkOrderStatus, { label: string; labelMn: string }> = {
  pending: { label: 'Pending', labelMn: 'Хүлээгдэж буй' },
  in_progress: { label: 'In Progress', labelMn: 'Хийгдэж буй' },
  completed: { label: 'Completed', labelMn: 'Дууссан' },
  cancelled: { label: 'Cancelled', labelMn: 'Цуцлагдсан' },
}

export type ParkingType = 'indoor' | 'outdoor' | 'guest' | 'reserved'
export const PARKING_TYPE: Record<ParkingType, { label: string; labelMn: string }> = {
  indoor: { label: 'Indoor', labelMn: 'Дотоод' },
  outdoor: { label: 'Outdoor', labelMn: 'Гадаад' },
  guest: { label: 'Guest', labelMn: 'Зочид' },
  reserved: { label: 'Reserved', labelMn: 'Нөөцлөгдсөн' },
}

export type AnnouncementType = 'news' | 'emergency' | 'maintenance'
export const ANNOUNCEMENT_TYPE: Record<AnnouncementType, { label: string; labelMn: string }> = {
  news: { label: 'News', labelMn: 'Мэдээ' },
  emergency: { label: 'Emergency Alert', labelMn: 'Яаралтай мэдэгдэл' },
  maintenance: { label: 'Maintenance Notice', labelMn: 'Засварын мэдэгдэл' },
}

export type VisitorStatus = 'invited' | 'checked_in' | 'checked_out' | 'cancelled'
export const VISITOR_STATUS: Record<VisitorStatus, { label: string; labelMn: string }> = {
  invited: { label: 'Invited', labelMn: 'Уригласан' },
  checked_in: { label: 'Checked In', labelMn: 'Ирсэн' },
  checked_out: { label: 'Checked Out', labelMn: 'Явсан' },
  cancelled: { label: 'Cancelled', labelMn: 'Цуцлагдсан' },
}

export interface PaginationState {
  page: number
  pageSize: number
}

export interface ListResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export interface SortState<T> {
  key: keyof T
  direction: 'asc' | 'desc'
}
