import { useMemo, useState } from 'react'
import { Plus, Wrench, MoreHorizontal, Pencil, Trash2, Building2, Home, Calendar, User } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { WorkOrderStatusBadge, WorkOrderPriorityBadge } from '@/shared/components/StatusBadges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useTableList, useTableInsert, useTableUpdate, useTableDelete } from '@/shared/hooks/use-crud'
import { supabase } from '@/shared/services/supabase'
import { useAuth } from '@/shared/hooks/use-auth'
import { WORK_ORDER_PRIORITY, WORK_ORDER_STATUS, type WorkOrderPriority, type WorkOrderStatus } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type WorkOrder = Database['public']['Tables']['work_orders']['Row']
type Building = Database['public']['Tables']['buildings']['Row']
type Apartment = Database['public']['Tables']['apartments']['Row']

const FORM = z.object({
  building_id: z.string().uuid('Байр сонгоно уу').optional().or(z.literal('')),
  apartment_id: z.string().uuid('Орц сонгоно уу').optional().or(z.literal('')),
  assigned_to: z.string().optional().or(z.literal('')),
  title: z.string().min(3, 'Гарчиг 3+ тэмдэгт'),
  description: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  scheduled_date: z.string().optional().or(z.literal('')),
  completed_at: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function WorkOrderDialog({
  open, value, onClose, buildings, apartments,
}: {
  open: boolean
  value: WorkOrder | null
  onClose: () => void
  buildings: Building[]
  apartments: Apartment[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          building_id: value.building_id ?? '',
          apartment_id: value.apartment_id ?? '',
          assigned_to: value.assigned_to ?? '',
          title: value.title,
          description: value.description ?? '',
          priority: value.priority as WorkOrderPriority,
          status: value.status as WorkOrderStatus,
          scheduled_date: value.scheduled_date ? value.scheduled_date.slice(0, 16) : '',
          completed_at: value.completed_at ? value.completed_at.slice(0, 16) : '',
        }
      : {
          status: 'pending',
          priority: 'medium',
          title: '',
        },
  })

  const insert = useTableInsert<'work_orders'>('work_orders')
  const update = useTableUpdate<'work_orders'>('work_orders')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<WorkOrder> = {
      ...(data as Partial<WorkOrder>),
      building_id: data.building_id ? data.building_id : null,
      apartment_id: data.apartment_id ? data.apartment_id : null,
      assigned_to: data.assigned_to ? data.assigned_to : null,
      scheduled_date: data.scheduled_date ? data.scheduled_date : null,
      completed_at: data.completed_at ? data.completed_at : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'workorder:updated' })
        toast.success('Засварын захиалга шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'workorder:created' })
        toast.success('Засварын захиалга нэмэгдлээ')
      }
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Засварын захиалга засах' : 'Шинэ засварын захиалга'}</DialogTitle>
          <DialogDescription>Засвар, засалтын ажил, хуваарилалт</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field name="building_id">
                <FieldLabel>Байр</FieldLabel>
                <Controller
                  name="building_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Байр сонгоно уу" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {buildings.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.block ? ` · ${b.block}` : ''}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field name="apartment_id">
                <FieldLabel>Орц</FieldLabel>
                <Controller
                  name="apartment_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Орц сонгоно уу" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {apartments.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.apartment_number}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field name="title" invalid={!!form.formState.errors.title}>
              <FieldLabel>Гарчиг</FieldLabel>
              <Input {...form.register('title')} placeholder="Цахилгааны сүлжээ засварлах..." />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field name="description"><FieldLabel>Тайлбар</FieldLabel><Textarea rows={3} {...form.register('description')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="priority" invalid={!!form.formState.errors.priority}>
                <FieldLabel>Чухал төлөв</FieldLabel>
                <Controller
                  name="priority"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(WORK_ORDER_PRIORITY) as WorkOrderPriority[]).map((p) => (
                            <SelectItem key={p} value={p}>{WORK_ORDER_PRIORITY[p].labelMn}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div>
                <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).map((s) => (
                    <Label key={s} className="flex cursor-pointer items-center justify-center rounded-lg border p-2 text-xs transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5">
                      <input type="radio" className="sr-only" value={s} {...form.register('status')} />
                      <WorkOrderStatusBadge status={s} />
                    </Label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="scheduled_date"><FieldLabel>Төлөвлөсөн огноо</FieldLabel><Input type="datetime-local" {...form.register('scheduled_date')} /></Field>
              <Field name="completed_at"><FieldLabel>Дууссан огноо</FieldLabel><Input type="datetime-local" {...form.register('completed_at')} /></Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Цуцлах</Button>
            <Button type="submit" disabled={insert.isPending || update.isPending}>
              {isEdit ? 'Хадгалах' : 'Үүсгэх'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function MaintenancePage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<WorkOrder | null | 'new'>(null)
  const { organizationId } = useAuth()

  const buildingsQ = useQuery({
    queryKey: ['buildings-list-wo', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('buildings').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Building[]
    }, enabled: !!organizationId,
  })

  const aptQ = useQuery({
    queryKey: ['apartments-select-wo', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('apartments').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Apartment[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'work_orders'>('work_orders', {
    select: '*, buildings(id,name,block), apartments(id,apartment_number)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<WorkOrder[]>(() => (list.data?.data as WorkOrder[]) ?? [], [list.data])
  const filtered = useTableSearch<WorkOrder>(rows, ['title', 'description', 'status', 'priority'], search)

  const remove = useTableDelete<'work_orders'>('work_orders', {
    onSuccess: () => toast.success('Засварын захиалга устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const buildingName = (id: string | null) => buildingsQ.data?.find((b) => b.id === id)?.name ?? '—'
  const apartmentNum = (id: string | null) => aptQ.data?.find((a) => a.id === id)?.apartment_number ?? '—'

  const cols: Column<WorkOrder>[] = [
    { key: 'title', header: 'Захиалга', className: 'font-medium', cell: (w) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-amber-500/10 text-amber-600">
          <Wrench className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate">{w.title}</div>
          <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            <WorkOrderPriorityBadge priority={w.priority as WorkOrderPriority} />
          </div>
        </div>
      </div>
    )},
    { key: 'building', header: 'Байр', className: 'hidden md:table-cell', cell: (w) => (
      <span className="inline-flex items-center gap-1 text-sm"><Building2 className="size-3 text-muted-foreground" />{buildingName(w.building_id)}</span>
    )},
    { key: 'apartment', header: 'Орц', className: 'hidden lg:table-cell', cell: (w) => (
      <span className="inline-flex items-center gap-1 text-sm"><Home className="size-3 text-muted-foreground" />{apartmentNum(w.apartment_id)}</span>
    )},
    { key: 'scheduled_date', header: 'Төлөвлөсөн', className: 'hidden md:table-cell', cell: (w) => w.scheduled_date
      ? <span className="inline-flex items-center gap-1 text-xs"><Calendar className="size-3 text-muted-foreground" />{w.scheduled_date.slice(0, 10)}</span>
      : '—'
    },
    { key: 'assigned_to', header: 'Хариуцагч', className: 'hidden lg:table-cell', cell: (w) => w.assigned_to
      ? <span className="inline-flex items-center gap-1 text-xs"><User className="size-3 text-muted-foreground" />#{w.assigned_to.slice(0, 6)}</span>
      : '—'
    },
    { key: 'status', header: 'Төлөв', cell: (w) => <WorkOrderStatusBadge status={w.status as WorkOrderStatus} /> },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', accessorFn: (w) => new Date(w.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading || buildingsQ.isLoading || aptQ.isLoading) {
    return (<><PageHeader title="Засвар" icon={Wrench} /><LoadingTable rows={6} cols={7} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Засвар" icon={Wrench} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Засварын ажил"
        description="Засвар, засалт, үйлчилгээний захиалгууд"
        icon={Wrench}
        breadcrumbs={[{ label: 'Удирдлага' }, { label: 'Засвар' }]}
        actions={<PageAction label="Шинэ захиалга" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<WorkOrder>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Гарчиг, тайлбар, төлөв... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'workorder:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <WorkOrderDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as WorkOrder | null)}
        onClose={() => setDialog(null)}
        buildings={buildingsQ.data ?? []}
        apartments={aptQ.data ?? []}
      />
    </div>
  )
}
