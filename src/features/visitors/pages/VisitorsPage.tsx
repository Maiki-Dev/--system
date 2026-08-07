import { useMemo, useState } from 'react'
import { Plus, UserCheck, MoreHorizontal, Pencil, Trash2, Home, User, Phone } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { VisitorStatusBadge } from '@/shared/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { VISITOR_STATUS, type VisitorStatus } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Visitor = Database['public']['Tables']['visitors']['Row']
type Apartment = Database['public']['Tables']['apartments']['Row']
type Resident = Database['public']['Tables']['residents']['Row']

const FORM = z.object({
  resident_id: z.string().uuid('Орон сууцчин сонгоно уу').optional().or(z.literal('')),
  apartment_id: z.string().uuid('Орц сонгоно уу').optional().or(z.literal('')),
  visitor_name: z.string().min(2, 'Зочидны нэр 2+ тэмдэгт'),
  visitor_phone: z.string().optional().or(z.literal('')),
  vehicle_plate: z.string().optional().or(z.literal('')),
  purpose: z.string().optional().or(z.literal('')),
  visit_date: z.string().min(1, 'Очих өдөр оруулна уу'),
  visit_time: z.string().optional().or(z.literal('')),
  status: z.enum(['invited', 'checked_in', 'checked_out', 'cancelled']),
  check_in_at: z.string().optional().or(z.literal('')),
  check_out_at: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function VisitorDialog({
  open, value, onClose, apartments, residents,
}: {
  open: boolean
  value: Visitor | null
  onClose: () => void
  apartments: Apartment[]
  residents: Resident[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          resident_id: value.resident_id ?? '',
          apartment_id: value.apartment_id ?? '',
          visitor_name: value.visitor_name,
          visitor_phone: value.visitor_phone ?? '',
          vehicle_plate: value.vehicle_plate ?? '',
          purpose: value.purpose ?? '',
          visit_date: value.visit_date.slice(0, 10),
          visit_time: value.visit_time ?? '',
          status: value.status as VisitorStatus,
          check_in_at: value.check_in_at ? value.check_in_at.slice(0, 16) : '',
          check_out_at: value.check_out_at ? value.check_out_at.slice(0, 16) : '',
          notes: value.notes ?? '',
        }
      : {
          status: 'invited',
          visitor_name: '',
          visit_date: new Date().toISOString().slice(0, 10),
        },
  })

  const insert = useTableInsert<'visitors'>('visitors')
  const update = useTableUpdate<'visitors'>('visitors')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data } as Partial<Visitor>
    if (!data.resident_id) payload.resident_id = null
    if (!data.apartment_id) payload.apartment_id = null
    if (!data.visit_time) payload.visit_time = null
    if (!data.check_in_at) payload.check_in_at = null
    if (!data.check_out_at) payload.check_out_at = null
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'visitor:updated' })
        toast.success('Зочин шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'visitor:created' })
        toast.success('Зочин бүртгэгдлээ')
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
          <DialogTitle>{isEdit ? 'Зочин засах' : 'Шинэ зочин бүртгэх'}</DialogTitle>
          <DialogDescription>Зочны мэдээлэл, очих орц, зорилго</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <Field name="visitor_name" invalid={!!form.formState.errors.visitor_name}>
              <FieldLabel>Зочидны нэр</FieldLabel>
              <Input {...form.register('visitor_name')} placeholder="Баттулга" />
              <FieldError>{form.formState.errors.visitor_name?.message}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="visitor_phone"><FieldLabel>Утас</FieldLabel><Input {...form.register('visitor_phone')} placeholder="99001122" /></Field>
              <Field name="vehicle_plate"><FieldLabel>Машины дугаар</FieldLabel><Input {...form.register('vehicle_plate')} placeholder="УӨБ-0101" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <Field name="resident_id">
                <FieldLabel>Орон сууцчин</FieldLabel>
                <Controller
                  name="resident_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
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
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="visit_date" invalid={!!form.formState.errors.visit_date}>
                <FieldLabel>Очих өдөр</FieldLabel>
                <Input type="date" {...form.register('visit_date')} />
                <FieldError>{form.formState.errors.visit_date?.message}</FieldError>
              </Field>
              <Field name="visit_time"><FieldLabel>Очих цаг</FieldLabel><Input type="time" {...form.register('visit_time')} /></Field>
            </div>
            <Field name="purpose"><FieldLabel>Зорилго</FieldLabel><Input {...form.register('purpose')} placeholder="Уулзалт, үйлчилгээ..." /></Field>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(VISITOR_STATUS) as VisitorStatus[]).map((s) => (
                  <Label key={s} className="flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-sm transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5">
                    <input type="radio" className="sr-only" value={s} {...form.register('status')} />
                    <VisitorStatusBadge status={s} />
                  </Label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="check_in_at"><FieldLabel>Ирсэн цаг</FieldLabel><Input type="datetime-local" {...form.register('check_in_at')} /></Field>
              <Field name="check_out_at"><FieldLabel>Явсан цаг</FieldLabel><Input type="datetime-local" {...form.register('check_out_at')} /></Field>
            </div>
            <Field name="notes"><FieldLabel>Тэмдэглэл</FieldLabel><Textarea rows={2} {...form.register('notes')} /></Field>
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

export default function VisitorsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Visitor | null | 'new'>(null)
  const { organizationId } = useAuth()

  const aptQ = useQuery({
    queryKey: ['apartments-select-vis', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('apartments').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Apartment[]
    }, enabled: !!organizationId,
  })

  const resQ = useQuery({
    queryKey: ['residents-select-vis', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Resident[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'visitors'>('visitors', {
    select: '*, apartments(id,apartment_number), residents(id,first_name,last_name)',
    page, pageSize: 10, order: { column: 'created_at' },
  })

  const rows = useMemo<Visitor[]>(() => (list.data?.data as Visitor[]) ?? [], [list.data])
  const filtered = useTableSearch<Visitor>(rows, ['visitor_name', 'visitor_phone', 'vehicle_plate', 'purpose', 'status'], search)

  const remove = useTableDelete<'visitors'>('visitors', {
    onSuccess: () => toast.success('Зочин устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const apartmentNum = (id: string | null) => aptQ.data?.find((a) => a.id === id)?.apartment_number ?? '—'
  const residentName = (id: string | null) => {
    const r = resQ.data?.find((x) => x.id === id)
    return r ? `${r.last_name} ${r.first_name}` : '—'
  }

  const cols: Column<Visitor>[] = [
    { key: 'visitor_name', header: 'Зочин', className: 'font-medium', cell: (v) => {
      const initials = v.visitor_name.trim().split(/\s+/).map((s) => s.charAt(0).toUpperCase()).slice(0, 2).join('') || 'ЗЧ'
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-2 ring-background">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate">{v.visitor_name}</div>
            <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
              {v.visitor_phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{v.visitor_phone}</span>}
            </div>
          </div>
        </div>
      )
    }},
    { key: 'apartment', header: 'Орц', className: 'hidden md:table-cell', cell: (v) => (
      <span className="inline-flex items-center gap-1 text-sm"><Home className="size-3 text-muted-foreground" />{apartmentNum(v.apartment_id)}</span>
    )},
    { key: 'resident', header: 'Орон сууцчин', className: 'hidden lg:table-cell', cell: (v) => (
      <span className="inline-flex items-center gap-1 text-sm"><User className="size-3 text-muted-foreground" />{residentName(v.resident_id)}</span>
    )},
    { key: 'visit_date', header: 'Очих өдөр', accessorFn: (v) => v.visit_date.slice(0, 10) },
    { key: 'vehicle_plate', header: 'Машин', className: 'hidden md:table-cell', cell: (v) => v.vehicle_plate ? <span className="font-mono text-xs">{v.vehicle_plate}</span> : '—' },
    { key: 'status', header: 'Төлөв', cell: (v) => <VisitorStatusBadge status={v.status as VisitorStatus} /> },
    { key: 'created_at', header: 'Бүртгэсэн', className: 'hidden lg:table-cell', accessorFn: (v) => new Date(v.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading || aptQ.isLoading || resQ.isLoading) {
    return (<><PageHeader title="Зочин" icon={UserCheck} /><LoadingTable rows={6} cols={7} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Зочин" icon={UserCheck} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Зочин"
        description="Зочны бүртгэл, ирц-гараг, орц руу очих зочдууд"
        icon={UserCheck}
        breadcrumbs={[{ label: 'Удирдлага' }, { label: 'Зочин' }]}
        actions={<PageAction label="Шинэ зочин" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Visitor>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Нэр, утас, машин... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'visitor:deleted', soft: false })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <VisitorDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Visitor | null)}
        onClose={() => setDialog(null)}
        apartments={aptQ.data ?? []}
        residents={resQ.data ?? []}
      />
    </div>
  )
}
