import { useMemo, useState } from 'react'
import { Plus, Users2, MoreHorizontal, Pencil, Trash2, User, Home, Phone, Mail } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { ResidentStatusBadge } from '@/shared/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { RESIDENT_STATUS, type ResidentStatus } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Resident = Database['public']['Tables']['residents']['Row']
type Apartment = Database['public']['Tables']['apartments']['Row']

const FORM = z.object({
  first_name: z.string().min(2, 'Нэр 2+ тэмдэгт'),
  last_name: z.string().min(2, 'Овог 2+ тэмдэгт'),
  register_number: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Имэйл буруу').optional().or(z.literal('')),
  apartment_id: z.string().uuid('Орц сонгоно уу').optional().or(z.literal('')),
  status: z.enum(['owner', 'tenant', 'inactive']),
  move_in_date: z.string().optional().or(z.literal('')),
  move_out_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function ResidentDialog({
  open, value, onClose, apartments,
}: { open: boolean; value: Resident | null; onClose: () => void; apartments: Apartment[] }) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          first_name: value.first_name,
          last_name: value.last_name,
          register_number: value.register_number ?? '',
          phone: value.phone ?? '',
          email: value.email ?? '',
          apartment_id: value.apartment_id ?? '',
          status: value.status as ResidentStatus,
          move_in_date: value.move_in_date ?? '',
          move_out_date: value.move_out_date ?? '',
          notes: value.notes ?? '',
        }
      : { status: 'tenant', first_name: '', last_name: '' },
  })
  const insert = useTableInsert<'residents'>('residents')
  const update = useTableUpdate<'residents'>('residents')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data } as Partial<Resident>
    if (!data.apartment_id) payload.apartment_id = null
    if (!data.move_in_date) payload.move_in_date = null
    if (!data.move_out_date) payload.move_out_date = null
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'resident:updated' })
        toast.success('Орон сууцчин шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'resident:created' })
        toast.success('Орон сууцчин бүртгэгдлээ')
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
          <DialogTitle>{isEdit ? 'Орон сууцчин засах' : 'Шинэ орон сууцчин бүртгэх'}</DialogTitle>
          <DialogDescription>Гишүүний мэдээлэл, орц, эзэмшигч/түрээслэгч</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field name="last_name" invalid={!!form.formState.errors.last_name}>
                <FieldLabel>Овог</FieldLabel>
                <Input {...form.register('last_name')} placeholder="Батболд" />
                <FieldError>{form.formState.errors.last_name?.message}</FieldError>
              </Field>
              <Field name="first_name" invalid={!!form.formState.errors.first_name}>
                <FieldLabel>Нэр</FieldLabel>
                <Input {...form.register('first_name')} placeholder="Дорж" />
                <FieldError>{form.formState.errors.first_name?.message}</FieldError>
              </Field>
              <Field name="register_number">
                <FieldLabel>Регистрийн дугаар</FieldLabel>
                <Input {...form.register('register_number')} placeholder="PP94120588" />
              </Field>
              <Field name="phone">
                <FieldLabel>Утас</FieldLabel>
                <Input {...form.register('phone')} placeholder="99110011" />
              </Field>
            </div>
            <Field name="email" invalid={!!form.formState.errors.email}>
              <FieldLabel>Имэйл</FieldLabel>
              <Input type="email" {...form.register('email')} placeholder="name@example.mn" />
              <FieldError>{form.formState.errors.email?.message}</FieldError>
            </Field>
            <Field name="apartment_id" invalid={!!form.formState.errors.apartment_id}>
              <FieldLabel>Орц (сонгох)</FieldLabel>
              <Controller
                name="apartment_id"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Орц сонгоно уу / эсвэл хоосон" />
                    </SelectTrigger>
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
              <FieldError>{form.formState.errors.apartment_id?.message}</FieldError>
            </Field>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(RESIDENT_STATUS) as ResidentStatus[]).map((s) => (
                  <Label key={s} className="flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-sm transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5">
                    <input type="radio" className="sr-only" value={s} {...form.register('status')} />
                    <ResidentStatusBadge status={s} />
                  </Label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="move_in_date"><FieldLabel>Нүүрсэн өдөр</FieldLabel><Input type="date" {...form.register('move_in_date')} /></Field>
              <Field name="move_out_date"><FieldLabel>Гарах өдөр</FieldLabel><Input type="date" {...form.register('move_out_date')} /></Field>
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

export default function ResidentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Resident | null | 'new'>(null)
  const { organizationId } = useAuth()

  const aptQ = useQuery({
    queryKey: ['apartments-select', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('apartments').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Apartment[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'residents'>('residents', {
    select: '*, apartments(id,apartment_number)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })
  const rows = useMemo<Resident[]>(() => (list.data?.data as Resident[]) ?? [], [list.data])
  const filtered = useTableSearch<Resident>(rows, ['first_name', 'last_name', 'register_number', 'phone', 'email'], search)
  const remove = useTableDelete<'residents'>('residents', {
    onSuccess: () => toast.success('Орон сууцчин устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const apartmentNum = (id: string | null) => {
    if (!id) return '—'
    const r = rows.find((x) => x.id === '!')
    void r
    return aptQ.data?.find((a) => a.id === id)?.apartment_number ?? '—'
  }

  const cols: Column<Resident>[] = [
    { key: 'name', header: 'Орон сууцчин', className: 'font-medium', cell: (r) => {
      const initials = [r.first_name, r.last_name].filter(Boolean).map((s) => s.trim().charAt(0).toUpperCase()).slice(0, 2).join('') || 'US'
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-2 ring-background">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate">{r.last_name} {r.first_name}</div>
            <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
              {r.register_number && <Badge variant="outline" className="text-[10px] font-mono">{r.register_number}</Badge>}
              <span className="flex items-center gap-1"><Home className="size-3" />{apartmentNum(r.apartment_id)}</span>
            </div>
          </div>
        </div>
      )
    }},
    { key: 'phone', header: 'Утас', className: 'hidden md:table-cell', cell: (r) => r.phone ? <span className="inline-flex items-center gap-1 text-sm"><Phone className="size-3 text-muted-foreground" />{r.phone}</span> : '—' },
    { key: 'email', header: 'Имэйл', className: 'hidden lg:table-cell', cell: (r) => r.email ? <span className="inline-flex items-center gap-1 text-sm"><Mail className="size-3 text-muted-foreground" />{r.email}</span> : '—' },
    { key: 'status', header: 'Төлөв', cell: (r) => <ResidentStatusBadge status={r.status as ResidentStatus} /> },
    { key: 'move_in_date', header: 'Нүүрсэн', className: 'hidden lg:table-cell', accessorFn: (r) => r.move_in_date ?? '—' },
    { key: 'created_at', header: 'Бүртгэсэн', className: 'hidden lg:table-cell', accessorFn: (r) => new Date(r.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading || aptQ.isLoading) return (<><PageHeader title="Орон сууцчид" icon={Users2} /><LoadingTable rows={6} cols={6} /></>)
  if (list.error) return (<><PageHeader title="Орон сууцчид" icon={Users2} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Орон сууцчид"
        description="Хотхоны гишүүд, гэрийн хүмүүс, холбоо барих мэдээлэл"
        icon={Users2}
        breadcrumbs={[{ label: 'Байр, Орц' }, { label: 'Орон сууцчид' }]}
        actions={<PageAction label="Шинэ гишүүн" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Resident>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Нэр, регистер, утас... хайх"
        actions={<Button variant="ghost" size="sm"><User className="size-4" />Олон гишүүн оруулах</Button>}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'resident:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ResidentDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Resident | null)}
        onClose={() => setDialog(null)}
        apartments={aptQ.data ?? []}
      />
    </div>
  )
}
