import { useMemo, useState } from 'react'
import { Plus, Car, MoreHorizontal, Pencil, Trash2, Building2 } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
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
import { Switch } from '@/components/ui/switch'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useTableList, useTableInsert, useTableUpdate, useTableDelete } from '@/shared/hooks/use-crud'
import { supabase } from '@/shared/services/supabase'
import { useAuth } from '@/shared/hooks/use-auth'
import { PARKING_TYPE, type ParkingType } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type ParkingSlot = Database['public']['Tables']['parking_slots']['Row']
type Building = Database['public']['Tables']['buildings']['Row']

const FORM = z.object({
  building_id: z.string().uuid('Байр сонгоно уу').optional().or(z.literal('')),
  slot_number: z.string().min(1, 'Суудлын дугаар оруулна уу'),
  type: z.enum(['indoor', 'outdoor', 'guest', 'reserved']),
  is_occupied: z.boolean(),
  monthly_fee: z.coerce.number().min(0).optional(),
})
type Form = z.infer<typeof FORM>

function ParkingDialog({
  open, value, onClose, buildings,
}: {
  open: boolean
  value: ParkingSlot | null
  onClose: () => void
  buildings: Building[]
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          building_id: value.building_id ?? '',
          slot_number: value.slot_number,
          type: value.type as ParkingType,
          is_occupied: value.is_occupied,
          monthly_fee: value.monthly_fee ?? undefined,
        }
      : {
          type: 'outdoor',
          slot_number: '',
          is_occupied: false,
        },
  })

  const insert = useTableInsert<'parking_slots'>('parking_slots')
  const update = useTableUpdate<'parking_slots'>('parking_slots')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<ParkingSlot> = {
      ...(data as Partial<ParkingSlot>),
      building_id: data.building_id ? data.building_id : null,
      monthly_fee: data.monthly_fee !== undefined ? data.monthly_fee : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'parking:updated' })
        toast.success('Паркинг шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'parking:created' })
        toast.success('Паркинг нэмэгдлээ')
      }
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Паркинг засах' : 'Шинэ паркинг нэмэх'}</DialogTitle>
          <DialogDescription>Паркинг суудал, төрөл, байрлалыг бүртгэнэ үү.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field name="slot_number" invalid={!!form.formState.errors.slot_number}>
                <FieldLabel>Суудлын дугаар</FieldLabel>
                <Input {...form.register('slot_number')} placeholder="P-101" />
                <FieldError>{form.formState.errors.slot_number?.message}</FieldError>
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
                          {(Object.keys(PARKING_TYPE) as ParkingType[]).map((t) => (
                            <SelectItem key={t} value={t}>{PARKING_TYPE[t].labelMn}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field name="building_id">
              <FieldLabel>Байр (сонгох)</FieldLabel>
              <Controller
                name="building_id"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Байр сонгоно уу" /></SelectTrigger>
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
            </Field>
            <Field name="monthly_fee"><FieldLabel>Сарын төлбөр (₮)</FieldLabel><Input type="number" step="1" {...form.register('monthly_fee')} /></Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Зэвсэгт эсэх</Label>
                <p className="text-xs text-muted-foreground">Энэ суудал одоо зэвсэгт байгаа эсэх</p>
              </div>
              <Controller
                name="is_occupied"
                control={form.control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <Field name="type"><FieldLabel>Тэмдэглэл</FieldLabel><Textarea rows={2} placeholder="Тусгай тэмдэглэл..." /></Field>
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

export default function ParkingPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<ParkingSlot | null | 'new'>(null)
  const { organizationId } = useAuth()

  const buildingsQ = useQuery({
    queryKey: ['buildings-list-park', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('buildings').select('*').eq('organization_id', organizationId!).is('deleted_at', null)
      return (data ?? []) as Building[]
    }, enabled: !!organizationId,
  })

  const list = useTableList<'parking_slots'>('parking_slots', {
    select: '*, buildings(id,name,block)',
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<ParkingSlot[]>(() => (list.data?.data as ParkingSlot[]) ?? [], [list.data])
  const filtered = useTableSearch<ParkingSlot>(rows, ['slot_number', 'type'], search)

  const remove = useTableDelete<'parking_slots'>('parking_slots', {
    onSuccess: () => toast.success('Паркинг устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const buildingName = (id: string | null) => buildingsQ.data?.find((b) => b.id === id)?.name ?? '—'
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('mn-MN') + ' ₮'

  const cols: Column<ParkingSlot>[] = [
    { key: 'slot_number', header: 'Суудал', className: 'font-medium', cell: (p) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-secondary text-primary">
          <Car className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono">{p.slot_number}</div>
          <div className="truncate text-xs text-muted-foreground">
            <Building2 className="mr-1 inline size-3 align-middle" />
            {buildingName(p.building_id)}
          </div>
        </div>
      </div>
    )},
    { key: 'type', header: 'Төрөл', cell: (p) => (
      <Badge variant="secondary">{PARKING_TYPE[p.type as ParkingType]?.labelMn ?? p.type}</Badge>
    )},
    { key: 'is_occupied', header: 'Зэвсэгт', cell: (p) => (
      p.is_occupied
        ? <Badge variant="destructive" className="bg-destructive/10 text-destructive">Зэвсэгт</Badge>
        : <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Хоосон</Badge>
    )},
    { key: 'monthly_fee', header: 'Сарын төлбөр', className: 'text-right hidden md:table-cell', cell: (p) => fmt(p.monthly_fee) },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', accessorFn: (p) => new Date(p.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading || buildingsQ.isLoading) {
    return (<><PageHeader title="Паркинг" icon={Car} /><LoadingTable rows={6} cols={5} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Паркинг" icon={Car} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Паркинг"
        description="Машны паркинг суудал, төрөл, зэвсэгт байдал"
        icon={Car}
        breadcrumbs={[{ label: 'Байр, Орц' }, { label: 'Паркинг' }]}
        actions={<PageAction label="Шинэ суудал" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<ParkingSlot>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Суудлын дугаар, төрөл... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'parking:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ParkingDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as ParkingSlot | null)}
        onClose={() => setDialog(null)}
        buildings={buildingsQ.data ?? []}
      />
    </div>
  )
}
