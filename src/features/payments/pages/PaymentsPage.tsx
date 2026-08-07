import { useMemo, useState } from 'react'
import { Plus, CreditCard, MoreHorizontal, Pencil, Trash2, FileText, User, Clock } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { PaymentStatusBadge } from '@/shared/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { PAYMENT_STATUS, type PaymentStatus } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Payment = Database['public']['Tables']['payments']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']
type Resident = Database['public']['Tables']['residents']['Row']

const PAYMENT_METHOD: Record<string, { label: string; labelMn: string }> = {
  cash: { label: 'Cash', labelMn: 'Бэлнээр' },
  bank_transfer: { label: 'Bank Transfer', labelMn: 'Банкны шилжүүлэг' },
  card: { label: 'Card', labelMn: 'Картаар' },
  qr: { label: 'QR', labelMn: 'QR код' },
  online: { label: 'Online', labelMn: 'Онлайн' },
}
type PaymentMethod = keyof typeof PAYMENT_METHOD

const FORM = z.object({
  invoice_id: z.string().uuid('Нэхэмжлэл сонгоно уу'),
  resident_id: z.string().uuid('Орон сууцчин сонгоно уу').optional().or(z.literal('')),
  amount: z.coerce.number().min(0, 'Дүн 0-с их байх'),
  method: z.enum(['cash', 'bank_transfer', 'card', 'qr', 'online']),
  transaction_id: z.string().optional().or(z.literal('')),
  status: z.enum(['paid', 'pending', 'overdue', 'cancelled']),
  reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  confirmed_at: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function PaymentDialog({
  open, value, onClose, invoices, residents,
}: {
  open: boolean
  value: Payment | null
  onClose: () => void
  invoices: Invoice[]
  residents: Resident[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: (value
      ? {
          invoice_id: value.invoice_id,
          resident_id: value.resident_id ?? '',
          amount: value.amount,
          method: (value.method as PaymentMethod) ?? 'bank_transfer',
          transaction_id: value.transaction_id ?? '',
          status: value.status as PaymentStatus,
          reference: value.reference ?? '',
          notes: value.notes ?? '',
          confirmed_at: value.confirmed_at ? value.confirmed_at.slice(0, 10) : '',
        }
      : {
          status: 'pending',
          method: 'bank_transfer',
          invoice_id: invoices[0]?.id ?? '',
          amount: 0,
        }) as Form,
  })

  const insert = useTableInsert<'payments'>('payments')
  const update = useTableUpdate<'payments'>('payments')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<Payment> = {
      ...(data as Partial<Payment>),
      resident_id: data.resident_id ? data.resident_id : null,
      transaction_id: data.transaction_id ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      confirmed_at: data.confirmed_at ? data.confirmed_at : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'payment:updated' })
        toast.success('Төлбөр шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'payment:created' })
        toast.success('Төлбөр бүртгэгдлээ')
      }
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Төлбөр засах' : 'Шинэ төлбөр бүртгэх'}</DialogTitle>
          <DialogDescription>Төлбөрийн мэдээлэл, хэлбэр, гүйлгээний дугаар</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <Field name="invoice_id" invalid={!!form.formState.errors.invoice_id}>
              <FieldLabel>Нэхэмжлэл</FieldLabel>
              <Controller
                name="invoice_id"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Нэхэмжлэл сонгоно уу" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number} — {inv.title} ({inv.total.toLocaleString('mn-MN')}₮)
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError>{form.formState.errors.invoice_id?.message}</FieldError>
            </Field>
            <Field name="resident_id">
              <FieldLabel>Орон сууцчин (сонгох)</FieldLabel>
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
            <div className="grid grid-cols-2 gap-3">
              <Field name="amount" invalid={!!form.formState.errors.amount}>
                <FieldLabel>Дүн (₮)</FieldLabel>
                <Input type="number" step="1" {...form.register('amount')} />
                <FieldError>{form.formState.errors.amount?.message}</FieldError>
              </Field>
              <Field name="method" invalid={!!form.formState.errors.method}>
                <FieldLabel>Төлбөрийн хэлбэр</FieldLabel>
                <Controller
                  name="method"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                            <SelectItem key={m} value={m}>{PAYMENT_METHOD[m]?.labelMn ?? m}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field name="transaction_id"><FieldLabel>Гүйлгээний дугаар</FieldLabel><Input {...form.register('transaction_id')} /></Field>
              <Field name="reference"><FieldLabel>Лавлагаа</FieldLabel><Input {...form.register('reference')} /></Field>
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
            <Field name="confirmed_at"><FieldLabel>Баталгаажсан өдөр</FieldLabel><Input type="date" {...form.register('confirmed_at')} /></Field>
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

export default function PaymentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Payment | null | 'new'>(null)
  const { organizationId } = useAuth()

  const invQ = useQuery({
    queryKey: ['invoices-select-pay', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('invoices').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Invoice[]
    }, enabled: !!organizationId,
  })

  const resQ = useQuery({
    queryKey: ['residents-select-pay', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Resident[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'payments'>('payments', {
    select: '*, invoices(id,invoice_number,title), residents(id,first_name,last_name)',
    page, pageSize: 10, order: { column: 'created_at' },
  })

  const rows = useMemo<Payment[]>(() => (list.data?.data as Payment[]) ?? [], [list.data])
  const filtered = useTableSearch<Payment>(rows, ['method', 'status', 'transaction_id', 'reference'], search)

  const remove = useTableDelete<'payments'>('payments', {
    onSuccess: () => toast.success('Төлбөр устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const invNum = (id: string | null) => invQ.data?.find((i) => i.id === id)?.invoice_number ?? '—'
  const residentName = (id: string | null) => {
    const r = resQ.data?.find((x) => x.id === id)
    return r ? `${r.last_name} ${r.first_name}` : '—'
  }
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('mn-MN') + ' ₮'

  const cols: Column<Payment>[] = [
    { key: 'id', header: 'Төлбөр', className: 'font-medium', cell: (p) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-secondary text-primary">
          <CreditCard className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-muted-foreground">#{p.id.slice(0, 8)}</div>
          <div className="flex items-center gap-1 truncate text-sm">
            <FileText className="size-3 text-muted-foreground" />
            {invNum(p.invoice_id)}
          </div>
        </div>
      </div>
    )},
    { key: 'method', header: 'Хэлбэр', cell: (p) => (
      <Badge variant="outline" className="font-normal">{PAYMENT_METHOD[p.method]?.labelMn ?? p.method}</Badge>
    )},
    { key: 'resident', header: 'Гишүүн', className: 'hidden md:table-cell', cell: (p) => (
      <span className="inline-flex items-center gap-1 text-sm"><User className="size-3 text-muted-foreground" />{residentName(p.resident_id)}</span>
    )},
    { key: 'amount', header: 'Дүн', className: 'text-right font-medium', cell: (p) => fmt(p.amount) },
    { key: 'transaction_id', header: 'Гүйлгээ', className: 'hidden lg:table-cell', cell: (p) => (
      p.transaction_id ? <span className="font-mono text-xs">{p.transaction_id}</span> : '—'
    )},
    { key: 'status', header: 'Төлөв', cell: (p) => <PaymentStatusBadge status={p.status as PaymentStatus} /> },
    { key: 'created_at', header: 'Бүртгэсэн', className: 'hidden lg:table-cell', cell: (p) => (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{new Date(p.created_at).toLocaleDateString('mn-MN')}</span>
    )},
  ]

  if (list.isLoading || invQ.isLoading || resQ.isLoading) {
    return (<><PageHeader title="Төлбөр" icon={CreditCard} /><LoadingTable rows={6} cols={7} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Төлбөр" icon={CreditCard} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Төлбөр"
        description="Оролцсон төлбөр, хэлбэр, гүйлгээний мэдээлэл"
        icon={CreditCard}
        breadcrumbs={[{ label: 'Санхүү' }, { label: 'Төлбөр' }]}
        actions={<PageAction label="Шинэ төлбөр" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Payment>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Гүйлгээ, хэлбэр, лавлагаа... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'payment:deleted', soft: false })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <PaymentDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Payment | null)}
        onClose={() => setDialog(null)}
        invoices={invQ.data ?? []}
        residents={resQ.data ?? []}
      />
    </div>
  )
}
