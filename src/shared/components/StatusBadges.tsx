import { Badge } from '@/components/ui/badge'
import type { ApartmentStatus, ComplaintStatus, ComplaintCategory, InvoiceType, PaymentStatus, ResidentStatus, VisitorStatus, WorkOrderPriority, WorkOrderStatus, AnnouncementType } from '@/shared/types'
import {
  APARTMENT_STATUS, COMPLAINT_CATEGORY, COMPLAINT_STATUS, INVOICE_TYPE,
  PAYMENT_STATUS, RESIDENT_STATUS, VISITOR_STATUS, WORK_ORDER_PRIORITY,
  WORK_ORDER_STATUS, ANNOUNCEMENT_TYPE,
} from '@/shared/types'

type Variant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'

const BADGE_VARIANTS: Record<string, Variant> = {
  occupied:    'success',
  vacant:      'secondary',
  maintenance: 'warning',

  owner:    'success',
  tenant:   'default',
  inactive: 'destructive',

  paid:      'success',
  pending:   'warning',
  overdue:   'destructive',
  cancelled: 'secondary',

  new:          'default',
  assigned:     'warning',
  in_progress:  'warning',
  resolved:     'success',
  closed:       'secondary',

  completed:  'success',

  critical: 'destructive',
  high:     'destructive',
  medium:   'warning',
  low:      'secondary',

  invited:     'default',
  checked_in:  'success',
  checked_out: 'secondary',

  news:        'secondary',
  emergency:   'destructive',
}

function variantOf(status: string | null | undefined): Variant {
  if (!status) return 'outline'
  const v = BADGE_VARIANTS[status]
  return v ?? 'outline'
}

export function StatusBadge<T extends string>({
  status,
  lookup,
  className,
}: {
  status: T
  lookup: Record<T, { label: string; labelMn: string }>
  className?: string
}) {
  const info = lookup[status]
  return (
    <Badge variant={variantOf(status as string) as never} className={className}>
      {info?.labelMn ?? status}
    </Badge>
  )
}

export function ApartmentStatusBadge({ status }: { status: ApartmentStatus }) {
  return <StatusBadge status={status} lookup={APARTMENT_STATUS} />
}

export function ResidentStatusBadge({ status }: { status: ResidentStatus }) {
  return <StatusBadge status={status} lookup={RESIDENT_STATUS} />
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge status={status} lookup={PAYMENT_STATUS} />
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  return <Badge variant="outline">{INVOICE_TYPE[type].labelMn}</Badge>
}

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <StatusBadge status={status} lookup={COMPLAINT_STATUS} />
}

export function ComplaintCategoryBadge({ category }: { category: ComplaintCategory }) {
  return <Badge variant="secondary">{COMPLAINT_CATEGORY[category].labelMn}</Badge>
}

export function WorkOrderPriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return <StatusBadge status={priority} lookup={WORK_ORDER_PRIORITY} />
}

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <StatusBadge status={status} lookup={WORK_ORDER_STATUS} />
}

export function VisitorStatusBadge({ status }: { status: VisitorStatus }) {
  return <StatusBadge status={status} lookup={VISITOR_STATUS} />
}

export function AnnouncementTypeBadge({ type }: { type: AnnouncementType }) {
  return <StatusBadge status={type} lookup={ANNOUNCEMENT_TYPE} />
}
