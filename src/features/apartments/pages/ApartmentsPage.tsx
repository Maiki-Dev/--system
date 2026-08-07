import { useMemo, useState } from 'react'
import { Plus, Home, MoreHorizontal, Pencil, Trash2, Building2 } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { ApartmentStatusBadge } from '@/shared/components/StatusBadges'
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
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTableList, useTableInsert, useTableUpdate, useTableDelete } from '@/shared/hooks/use-crud'
import { useAuth } from '@/shared/hooks/use-auth'
import type { Database } from '@/shared/types/database'
import { APARTMENT_STATUS, type ApartmentStatus } from '@/shared/types'
import { Label } from '@/components/ui/label'
import { supabase } from '@/shared/services/supabase'
import { useQuery } from '@tanstack/react-query'

type Apartment = Database['public']['Tables']['apartments']['Row']
type Building = Database['public']['Tables']['buildings']['Row']

const FORM = z.object({
  building_id: z.string().uuid('Байр сонгоно уу'),
  apartment_number: z.string().min(1, 'Орцны дугаар оруулна уу'),
  floor: z.coerce.number().int().optional(),
  area_sqm: z.coerce.number().positive().optional(),
  room_count: z.coerce.number().int().positive().optional(),
  status: z.enum(['occupied', 'vacant', 'maintenance']),
  notes: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function ApartmentDialog({
  open, value, onClose, buildings,
}: { open: boolean; value: Apartment | null; onClose: () => void; buildings: Building[] }) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          building_id: value.building_id,
          apartment_number: value.apartment_number,
          floor: value.floor ?? undefined,
          area_sqm: value.area_sqm ? Number(value.area_sqm) : undefined,
          room_count: value.room_count ?? undefined,
          status: value.status as ApartmentStatus,
          notes: value.notes ?? '',
        }
      : { status: 'vacant', apartment_number: '', building_id: buildings[0]?.id ?? '' },
  })
  const insert = useTableInsert<'apartments'>('apartments')
  const update = useTableUpdate<'apartments'>('apartments')

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload: data, logAction: 'apartment:updated' })
        toast.success('Орц шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...data, logAction: 'apartment:created' })
        toast.success('Орц нэмэгдлээ')
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
          <DialogTitle>{isEdit ? 'Орц засах' : 'Шинэ орц нэмэх'}</DialogTitle>
          <DialogDescription>Байр, давхар, хэмжээ, төлөвийг зааж бүртгэнэ үү.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <Field name="building_id" invalid={!!form.formState.errors.building_id}>
              <FieldLabel>Байр</FieldLabel>
              <Controller
                name="building_id"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Байр сонгоно уу" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}{b.block ? ` · ${b.block} блок` : ''}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError>{form.formState.errors.building_id?.message}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="apartment_number" invalid={!!form.formState.errors.apartment_number}>
                <FieldLabel>Орцны дугаар</FieldLabel>
                <Input placeholder="A-101" {...form.register('apartment_number')} />
                <FieldError>{form.formState.errors.apartment_number?.message}</FieldError>
              </Field>
              <Field name="floor" invalid={!!form.formState.errors.floor}>
                <FieldLabel>Давхар</FieldLabel>
                <Input type="number" {...form.register('floor')} />
                <FieldError>{form.formState.errors.floor?.message}</FieldError>
              </Field>
              <Field name="area_sqm" invalid={!!form.formState.errors.area_sqm}>
                <FieldLabel>Талбай (м²)</FieldLabel>
                <Input type="number" step="0.01" {...form.register('area_sqm')} />
                <FieldError>{form.formState.errors.area_sqm?.message}</FieldError>
              </Field>
              <Field name="room_count" invalid={!!form.formState.errors.room_count}>
                <FieldLabel>Өрөөний тоо</FieldLabel>
                <Input type="number" {...form.register('room_count')} />
                <FieldError>{form.formState.errors.room_count?.message}</FieldError>
              </Field>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Төлөв</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(APARTMENT_STATUS) as ApartmentStatus[]).map((s) => (
                  <Label
                    key={s}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 text-sm transition [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      value={s}
                      {...form.register('status')}
                    />
                    <ApartmentStatusBadge status={s} />
                  </Label>
                ))}
              </div>
            </div>
            <Field name="notes">
              <FieldLabel>Тэмдэглэл</FieldLabel>
              <Textarea rows={2} {...form.register('notes')} />
            </Field>
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

export default function ApartmentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Apartment | null | 'new'>(null)
  const { organizationId } = useAuth()

  const buildingsQuery = useQuery({
    queryKey: ['buildings-list-apts', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('buildings').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Building[]
    },
    enabled: !!organizationId,
  })

  const list = useTableList<'apartments'>('apartments', {
    select: '*, buildings(id,name,block)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<Apartment[]>(() => (list.data?.data as Apartment[]) ?? [], [list.data])
  const filtered = useTableSearch<Apartment & { buildings?: Building | null }>(
    rows as never,
    ['apartment_number', 'status', 'floor', 'qr_code'],
    search
  )

  const remove = useTableDelete<'apartments'>('apartments', {
    onSuccess: () => toast.success('Орц устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const buildingName = (id: string) => buildingsQuery.data?.find((b) => b.id === id)?.name ?? ''

  const cols: Column<Apartment>[] = [
    { key: 'apartment_number', header: 'Орц', className: 'font-medium', cell: (a) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-secondary text-primary">
          <Home className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate">{a.apartment_number}</div>
          <div className="truncate text-xs text-muted-foreground">
            <Building2 className="mr-1 inline size-3 align-middle" />
            {buildingName(a.building_id)}
          </div>
        </div>
      </div>
    )},
    { key: 'floor', header: 'Давхар', className: 'text-center', accessorFn: (a) => a.floor ?? '—' },
    { key: 'area_sqm', header: 'м²', className: 'text-right hidden md:table-cell', accessorFn: (a) => a.area_sqm ? `${a.area_sqm} м²` : '—' },
    { key: 'room_count', header: 'Өрөө', className: 'text-center hidden lg:table-cell', accessorFn: (a) => a.room_count ?? '—' },
    { key: 'status', header: 'Төлөв', cell: (a) => <ApartmentStatusBadge status={a.status as ApartmentStatus} /> },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', accessorFn: (a) => new Date(a.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading || buildingsQuery.isLoading) {
    return (<><PageHeader title="Орон сууц" icon={Home} /><LoadingTable rows={8} cols={6} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Орон сууц" icon={Home} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Орон сууц"
        description="Байр дахь орцууд, төлөв, хэмжээ, эзэмшигчдийг удирдах"
        icon={Home}
        breadcrumbs={[{ label: 'Байр, Орц' }, { label: 'Орон сууц' }]}
        actions={<PageAction label="Шинэ орц" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Apartment>
        data={filtered as Apartment[]}
        columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Орцны дугаар, давхар, төлөв... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'apartment:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ApartmentDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Apartment | null)}
        onClose={() => setDialog(null)}
        buildings={buildingsQuery.data ?? []}
      />
    </div>
  )
}
