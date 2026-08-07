import { useMemo, useState } from 'react'
import { Plus, FileText, MoreHorizontal, Pencil, Trash2, Home, User } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { PaymentStatusBadge, InvoiceTypeBadge } from '@/shared/components/StatusBadges'
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
import { INVOICE_TYPE, PAYMENT_STATUS, type InvoiceType, type PaymentStatus } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type Apartment = Database['public']['Tables']['apartments']['Row']
type Resident = Database['public']['Tables']['residents']['Row']

const FORM = z.object({
  apartment_id: z.string().uuid('Орц сонгоно уу').optional().or(z.literal('')),
  resident_id: z.string().uuid('Орон сууцчин сонгоно уу').optional().or(z.literal('')),
  invoice_number: z.string().min(1, 'Нэхэмжлэлийн дугаар оруулна уу'),
  type: z.enum(['hoa_fee', 'parking', 'water', 'electricity', 'internet', 'cleaning', 'elevator', 'repair_fund', 'custom']),
  title: z.string().min(2, 'Гарчиг 2+ тэмдэгт'),
  description: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().min(0, 'Дүн 0-с их байх'),
  tax: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0, 'Нийт дүн 0-с их байх'),
  status: z.enum(['paid', 'pending', 'overdue', 'cancelled']),
  due_date: z.string().min(1, 'Хугацаа оруулна уу'),
  paid_at: z.string().optional().or(z.literal('')),
  period_month: z.coerce.number().int().min(1).max(12).optional(),
  period_year: z.coerce.number().int().min(2000).max(2100).optional(),
  late_fee: z.coerce.number().min(0).optional(),
  notes: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function InvoiceDialog({
  open, value, onClose, apartments, residents,
}: {
  open: boolean
  value: Invoice | null
  onClose: () => void
  apartments: Apartment[]
  residents: Resident[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          apartment_id: value.apartment_id ?? '',
          resident_id: value.resident_id ?? '',
          invoice_number: value.invoice_number,
          type: value.type as InvoiceType,
          title: value.title,
          description: value.description ?? '',
          amount: value.amount,
          tax: value.tax ?? 0,
          discount: value.discount ?? 0,
          total: value.total,
          status: value.status as PaymentStatus,
          due_date: value.due_date.slice(0, 10),
          paid_at: value.paid_at ? value.paid_at.slice(0, 10) : '',
          period_month: value.period_month ?? undefined,
          period_year: value.period_year ?? undefined,
          late_fee: value.late_fee ?? 0,
          notes: value.notes ?? '',
        }
      : {
          status: 'pending',
          type: 'hoa_fee',
          invoice_number: '',
          title: '',
          amount: 0,
          tax: 0,
          discount: 0,
          total: 0,
          due_date: new Date().toISOString().slice(0, 10),
          late_fee: 0,
        },
  })

  const insert = useTableInsert<'invoices'>('invoices')
  const update = useTableUpdate<'invoices'>('invoices')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<Invoice> = {
      ...(data as Partial<Invoice>),
      apartment_id: data.apartment_id ? data.apartment_id : null,
      resident_id: data.resident_id ? data.resident_id : null,
      description: data.description ?? null,
      paid_at: data.paid_at ? data.paid_at : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'invoice:updated' })
        toast.success('Нэхэмжлэл шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'invoice:created' })
        toast.success('Нэхэмжлэл нэмэгдлээ')
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
          <DialogTitle>{isEdit ? 'Нэхэмжлэл засах' : 'Шинэ нэхэмжлэл үүсгэх'}</DialogTitle>
          <DialogDescription>Төлбөрийн нэхэмжлэл бүртгэх, өөрчлөх</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field name="invoice_number" invalid={!!form.formState.errors.invoice_number}>
                <FieldLabel>Нэхэмжлэлийн дугаар</FieldLabel>
                <Input {...form.register('invoice_number')} placeholder="INV-2024-001" />
                <FieldError>{form.formState.errors.invoice_number?.message}</FieldError>
              </Field>
              <Field name="type" invalid={!!form.formState.errors.type}>
                <FieldLabel>Төрөл</FieldLabel>
                <Controller
                  name="type"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(INVOICE_TYPE) as InvoiceType[]).map((t) => (
                            <SelectItem key={t} value={t}>{INVOICE_TYPE[t].labelMn}</SelectItem>
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
              <Input {...form.register('title')} placeholder="2024 оны 5-р сарын СӨХ төлбөр" />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
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
              <Field name="amount" invalid={!!form.formState.errors.amount}>
                <FieldLabel>Үнэ (₮)</FieldLabel>
                <Input type="number" step="1" {...form.register('amount')} />
                <FieldError>{form.formState.errors.amount?.message}</FieldError>
              </Field>
              <Field name="tax"><FieldLabel>НӨАТ (₮)</FieldLabel><Input type="number" step="1" {...form.register('tax')} /></Field>
              <Field name="discount"><FieldLabel>Хөнгөлөлт (₮)</FieldLabel><Input type="number" step="1" {...form.register('discount')} /></Field>
              <Field name="total" invalid={!!form.formState.errors.total}>
                <FieldLabel>Нийт дүн (₮)</FieldLabel>
                <Input type="number" step="1" {...form.register('total')} />
                <FieldError>{form.formState.errors.total?.message}</FieldError>
              </Field>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => (
                  <Label key={s} className="flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-sm transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5">
                    <input type="radio" className="sr-only" value={s} {...form.register('status')} />
                    <PaymentStatusBadge status={s} />
                  </Label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="due_date" invalid={!!form.formState.errors.due_date}>
                <FieldLabel>Төлөх хугацаа</FieldLabel>
                <Input type="date" {...form.register('due_date')} />
                <FieldError>{form.formState.errors.due_date?.message}</FieldError>
              </Field>
              <Field name="paid_at"><FieldLabel>Төлсөн өдөр</FieldLabel><Input type="date" {...form.register('paid_at')} /></Field>
              <Field name="period_month"><FieldLabel>Сар</FieldLabel><Input type="number" min={1} max={12} {...form.register('period_month')} /></Field>
              <Field name="period_year"><FieldLabel>Жил</FieldLabel><Input type="number" min={2000} max={2100} {...form.register('period_year')} /></Field>
            </div>
            <Field name="late_fee"><FieldLabel>Хоцролтын шимтгэл (₮)</FieldLabel><Input type="number" step="1" {...form.register('late_fee')} /></Field>
            <Field name="description"><FieldLabel>Тайлбар</FieldLabel><Textarea rows={2} {...form.register('description')} /></Field>
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

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Invoice | null | 'new'>(null)
  const { organizationId } = useAuth()

  const aptQ = useQuery({
    queryKey: ['apartments-select-inv', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('apartments').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Apartment[]
    }, enabled: !!organizationId,
  })

  const resQ = useQuery({
    queryKey: ['residents-select-inv', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Resident[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'invoices'>('invoices', {
    select: '*, apartments(id,apartment_number), residents(id,first_name,last_name)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<Invoice[]>(() => (list.data?.data as Invoice[]) ?? [], [list.data])
  const filtered = useTableSearch<Invoice>(rows, ['invoice_number', 'title', 'type', 'status'], search)

  const remove = useTableDelete<'invoices'>('invoices', {
    onSuccess: () => toast.success('Нэхэмжлэл устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const apartmentNum = (id: string | null) => aptQ.data?.find((a) => a.id === id)?.apartment_number ?? '—'
  const residentName = (id: string | null) => {
    const r = resQ.data?.find((x) => x.id === id)
    return r ? `${r.last_name} ${r.first_name}` : '—'
  }

  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('mn-MN') + ' ₮'

  const cols: Column<Invoice>[] = [
    { key: 'invoice_number', header: 'Нэхэмжлэл', className: 'font-medium', cell: (inv) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-secondary text-primary">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-sm">{inv.invoice_number}</div>
          <div className="truncate text-xs text-muted-foreground">{inv.title}</div>
        </div>
      </div>
    )},
    { key: 'type', header: 'Төрөл', cell: (inv) => <InvoiceTypeBadge type={inv.type as InvoiceType} /> },
    { key: 'apartment', header: 'Орц', className: 'hidden md:table-cell', cell: (inv) => (
      <span className="inline-flex items-center gap-1 text-sm"><Home className="size-3 text-muted-foreground" />{apartmentNum(inv.apartment_id)}</span>
    )},
    { key: 'resident', header: 'Гишүүн', className: 'hidden lg:table-cell', cell: (inv) => (
      <span className="inline-flex items-center gap-1 text-sm"><User className="size-3 text-muted-foreground" />{residentName(inv.resident_id)}</span>
    )},
    { key: 'total', header: 'Нийт', className: 'text-right font-medium', cell: (inv) => fmt(inv.total) },
    { key: 'status', header: 'Төлөв', cell: (inv) => <PaymentStatusBadge status={inv.status as PaymentStatus} /> },
    { key: 'due_date', header: 'Хугацаа', className: 'hidden lg:table-cell', accessorFn: (inv) => inv.due_date.slice(0, 10) },
  ]

  if (list.isLoading || aptQ.isLoading || resQ.isLoading) {
    return (<><PageHeader title="Нэхэмжлэл" icon={FileText} /><LoadingTable rows={6} cols={7} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Нэхэмжлэл" icon={FileText} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Нэхэмжлэл"
        description="Төлбөрийн нэхэмжлэл, төлөв, хугацааг удирдах"
        icon={FileText}
        breadcrumbs={[{ label: 'Санхүү' }, { label: 'Нэхэмжлэл' }]}
        actions={<PageAction label="Шинэ нэхэмжлэл" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Invoice>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Дугаар, гарчиг, төрөл... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'invoice:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <InvoiceDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Invoice | null)}
        onClose={() => setDialog(null)}
        apartments={aptQ.data ?? []}
        residents={resQ.data ?? []}
      />
    </div>
  )
}
