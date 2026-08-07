import { useMemo, useState } from 'react'
import { Plus, MessageSquareWarning, MoreHorizontal, Pencil, Trash2, Home, User, Clock } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { ComplaintStatusBadge, ComplaintCategoryBadge } from '@/shared/components/StatusBadges'
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
import { COMPLAINT_CATEGORY, COMPLAINT_STATUS, WORK_ORDER_PRIORITY, type ComplaintCategory, type ComplaintStatus, type WorkOrderPriority } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Complaint = Database['public']['Tables']['complaints']['Row']
type Resident = Database['public']['Tables']['residents']['Row']
type Apartment = Database['public']['Tables']['apartments']['Row']

const FORM = z.object({
  resident_id: z.string().uuid('Орон сууцчин сонгоно уу'),
  apartment_id: z.string().uuid('Орц сонгоно уу').optional().or(z.literal('')),
  category: z.enum(['cleaning', 'noise', 'parking', 'elevator', 'security', 'water', 'electricity', 'other']),
  title: z.string().min(3, 'Гарчиг 3+ тэмдэгт'),
  description: z.string().min(5, 'Тайлбар 5+ тэмдэгт'),
  status: z.enum(['new', 'assigned', 'in_progress', 'resolved', 'closed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().or(z.literal('')),
  assigned_to: z.string().optional().or(z.literal('')),
  resolved_at: z.string().optional().or(z.literal('')),
  closed_at: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function ComplaintDialog({
  open, value, onClose, residents, apartments,
}: {
  open: boolean
  value: Complaint | null
  onClose: () => void
  residents: Resident[]
  apartments: Apartment[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          resident_id: value.resident_id,
          apartment_id: value.apartment_id ?? '',
          category: value.category as ComplaintCategory,
          title: value.title,
          description: value.description,
          status: value.status as ComplaintStatus,
          priority: (value.priority as WorkOrderPriority) ?? '',
          assigned_to: value.assigned_to ?? '',
          resolved_at: value.resolved_at ? value.resolved_at.slice(0, 16) : '',
          closed_at: value.closed_at ? value.closed_at.slice(0, 16) : '',
        }
      : {
          status: 'new',
          category: 'other',
          title: '',
          description: '',
          resident_id: residents[0]?.id ?? '',
          priority: 'medium',
        },
  })

  const insert = useTableInsert<'complaints'>('complaints')
  const update = useTableUpdate<'complaints'>('complaints')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<Complaint> = {
      ...(data as Partial<Complaint>),
      apartment_id: data.apartment_id ? data.apartment_id : null,
      priority: data.priority ? data.priority : null,
      assigned_to: data.assigned_to ? data.assigned_to : null,
      resolved_at: data.resolved_at ? data.resolved_at : null,
      closed_at: data.closed_at ? data.closed_at : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'complaint:updated' })
        toast.success('Санал хүсэлт шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'complaint:created' })
        toast.success('Санал хүсэлт нэмэгдлээ')
      }
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Санал хүсэлт засах' : 'Шинэ санал хүсэлт бүртгэх'}</DialogTitle>
          <DialogDescription>Гомдол, санал хүсэлтийг бүртгэх, удирдах</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field name="resident_id" invalid={!!form.formState.errors.resident_id}>
                <FieldLabel>Орон сууцчин</FieldLabel>
                <Controller
                  name="resident_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Орон сууцчин сонгоно уу" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {residents.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.last_name} {r.first_name}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.resident_id?.message}</FieldError>
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
            <div className="grid grid-cols-2 gap-3">
              <Field name="category" invalid={!!form.formState.errors.category}>
                <FieldLabel>Төрөл</FieldLabel>
                <Controller
                  name="category"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(COMPLAINT_CATEGORY) as ComplaintCategory[]).map((c) => (
                            <SelectItem key={c} value={c}>{COMPLAINT_CATEGORY[c].labelMn}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field name="priority">
                <FieldLabel>Чухал төлөв</FieldLabel>
                <Controller
                  name="priority"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Чухал төлөв сонгоно уу" /></SelectTrigger>
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
            </div>
            <Field name="title" invalid={!!form.formState.errors.title}>
              <FieldLabel>Гарчиг</FieldLabel>
              <Input {...form.register('title')} placeholder="Шатгайн алдаа гарсан..." />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field name="description" invalid={!!form.formState.errors.description}>
              <FieldLabel>Тайлбар</FieldLabel>
              <Textarea rows={4} {...form.register('description')} placeholder="Дэлгэрэнгүй тайлбар..." />
              <FieldError>{form.formState.errors.description?.message}</FieldError>
            </Field>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(COMPLAINT_STATUS) as ComplaintStatus[]).map((s) => (
                  <Label key={s} className="flex cursor-pointer items-center justify-center rounded-lg border p-2 text-xs transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5">
                    <input type="radio" className="sr-only" value={s} {...form.register('status')} />
                    <ComplaintStatusBadge status={s} />
                  </Label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="resolved_at"><FieldLabel>Шийдэгдсэн цаг</FieldLabel><Input type="datetime-local" {...form.register('resolved_at')} /></Field>
              <Field name="closed_at"><FieldLabel>Хаагдсан цаг</FieldLabel><Input type="datetime-local" {...form.register('closed_at')} /></Field>
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

export default function ComplaintsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Complaint | null | 'new'>(null)
  const { organizationId } = useAuth()

  const resQ = useQuery({
    queryKey: ['residents-select-comp', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Resident[]
    }, enabled: !!organizationId,
  })

  const aptQ = useQuery({
    queryKey: ['apartments-select-comp', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('apartments').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Apartment[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'complaints'>('complaints', {
    select: '*, apartments(id,apartment_number), residents(id,first_name,last_name)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<Complaint[]>(() => (list.data?.data as Complaint[]) ?? [], [list.data])
  const filtered = useTableSearch<Complaint>(rows, ['title', 'description', 'category', 'status'], search)

  const remove = useTableDelete<'complaints'>('complaints', {
    onSuccess: () => toast.success('Санал хүсэлт устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const residentName = (id: string | null) => {
    const r = resQ.data?.find((x) => x.id === id)
    return r ? `${r.last_name} ${r.first_name}` : '—'
  }
  const apartmentNum = (id: string | null) => aptQ.data?.find((a) => a.id === id)?.apartment_number ?? '—'

  const cols: Column<Complaint>[] = [
    { key: 'title', header: 'Санал хүсэлт', className: 'font-medium', cell: (c) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-primary/10 text-primary">
          <MessageSquareWarning className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate">{c.title}</div>
          <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            <ComplaintCategoryBadge category={c.category as ComplaintCategory} />
          </div>
        </div>
      </div>
    )},
    { key: 'resident', header: 'Гишүүн', className: 'hidden md:table-cell', cell: (c) => (
      <span className="inline-flex items-center gap-1 text-sm"><User className="size-3 text-muted-foreground" />{residentName(c.resident_id)}</span>
    )},
    { key: 'apartment', header: 'Орц', className: 'hidden lg:table-cell', cell: (c) => (
      <span className="inline-flex items-center gap-1 text-sm"><Home className="size-3 text-muted-foreground" />{apartmentNum(c.apartment_id)}</span>
    )},
    { key: 'priority', header: 'Чухал', className: 'hidden md:table-cell', cell: (c) => (
      c.priority
        ? <span className={`text-xs font-medium ${
            c.priority === 'critical' ? 'text-destructive' : c.priority === 'high' ? 'text-destructive' : c.priority === 'medium' ? 'text-amber-600' : 'text-muted-foreground'
          }`}>{WORK_ORDER_PRIORITY[c.priority as WorkOrderPriority]?.labelMn ?? c.priority}</span>
        : '—'
    )},
    { key: 'status', header: 'Төлөв', cell: (c) => <ComplaintStatusBadge status={c.status as ComplaintStatus} /> },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', cell: (c) => (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{new Date(c.created_at).toLocaleDateString('mn-MN')}</span>
    )},
  ]

  if (list.isLoading || resQ.isLoading || aptQ.isLoading) {
    return (<><PageHeader title="Санал хүсэлт" icon={MessageSquareWarning} /><LoadingTable rows={6} cols={6} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Санал хүсэлт" icon={MessageSquareWarning} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Санал хүсэлт"
        description="Гомдол, санал хүсэлт, шийдвэрлэлтийн явц"
        icon={MessageSquareWarning}
        breadcrumbs={[{ label: 'Удирдлага' }, { label: 'Санал хүсэлт' }]}
        actions={<PageAction label="Шинэ санал" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Complaint>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Гарчиг, тайлбар, төрөл... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'complaint:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ComplaintDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Complaint | null)}
        onClose={() => setDialog(null)}
        residents={resQ.data ?? []}
        apartments={aptQ.data ?? []}
      />
    </div>
  )
}
