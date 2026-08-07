import { useMemo, useState } from 'react'
import { Plus, Building2, MoreHorizontal, Pencil, Trash2, Search as SearchIcon } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTableList, useTableInsert, useTableUpdate, useTableDelete } from '@/shared/hooks/use-crud'
import type { Database } from '@/shared/types/database'

type Building = Database['public']['Tables']['buildings']['Row']

const FORM = z.object({
  name: z.string().min(2, 'Байрны нэр дор хаяж 2 тэмдэгт'),
  block: z.string().max(8).optional().or(z.literal('')),
  entrance: z.string().max(8).optional().or(z.literal('')),
  floors: z.coerce.number().int().positive('Давхар 0-с их байх').optional(),
  apartment_count: z.coerce.number().int().positive().optional(),
  address: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
})

type Form = z.infer<typeof FORM>

function BuildingDialog({
  open, value, onClose,
}: {
  open: boolean
  value: Building | null
  onClose: () => void
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          name: value.name,
          block: value.block ?? '',
          entrance: value.entrance ?? '',
          floors: value.floors ?? undefined,
          apartment_count: value.apartment_count ?? undefined,
          address: value.address ?? '',
          description: value.description ?? '',
        }
      : { name: '', block: '', entrance: '', address: '', description: '' },
  })

  const insert = useTableInsert<'buildings'>('buildings')
  const update = useTableUpdate<'buildings'>('buildings')

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload: data, logAction: 'building:updated' })
        toast.success('Байршил шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...data, logAction: 'building:created' })
        toast.success('Байршил нэмэгдлээ')
      }
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Байршил засах' : 'Шинэ байршил нэмэх'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Байрны мэдээллийг шинэчилнэ үү.' : 'Хотхонд шинэ байр/блок бүртгэнэ үү.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <Field name="name" invalid={!!form.formState.errors.name}>
              <FieldLabel>Нэр</FieldLabel>
              <Input placeholder="Skyline Tower A" {...form.register('name')} />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="block" invalid={!!form.formState.errors.block}>
                <FieldLabel>Блок</FieldLabel>
                <Input placeholder="A" {...form.register('block')} />
                <FieldError>{form.formState.errors.block?.message}</FieldError>
              </Field>
              <Field name="entrance" invalid={!!form.formState.errors.entrance}>
                <FieldLabel>Орц</FieldLabel>
                <Input placeholder="1" {...form.register('entrance')} />
                <FieldError>{form.formState.errors.entrance?.message}</FieldError>
              </Field>
              <Field name="floors" invalid={!!form.formState.errors.floors}>
                <FieldLabel>Давхар</FieldLabel>
                <Input type="number" min={1} {...form.register('floors')} />
                <FieldError>{form.formState.errors.floors?.message}</FieldError>
              </Field>
              <Field name="apartment_count" invalid={!!form.formState.errors.apartment_count}>
                <FieldLabel>Орцны тоо</FieldLabel>
                <Input type="number" min={1} {...form.register('apartment_count')} />
                <FieldError>{form.formState.errors.apartment_count?.message}</FieldError>
              </Field>
            </div>
            <Field name="address" invalid={!!form.formState.errors.address}>
              <FieldLabel>Хаяг</FieldLabel>
              <Input placeholder="УБ, Хан-Уул, 11-р хороо..." {...form.register('address')} />
              <FieldError>{form.formState.errors.address?.message}</FieldError>
            </Field>
            <Field name="description" invalid={!!form.formState.errors.description}>
              <FieldLabel>Тайлбар</FieldLabel>
              <Textarea rows={3} {...form.register('description')} />
              <FieldError>{form.formState.errors.description?.message}</FieldError>
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

export default function BuildingsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Building | null | 'new'>(null)

  const list = useTableList<'buildings'>('buildings', {
    select: '*, apartments(count)', pageSize: 10, page,
    order: { column: 'created_at' },
  })

  const rows = useMemo<Building[]>(() => {
    if (!list.data?.data) return []
    return list.data.data as Building[]
  }, [list.data])

  const filtered = useTableSearch<Building>(rows, ['name', 'block', 'entrance', 'address'], search)

  const remove = useTableDelete<'buildings'>('buildings', {
    onSuccess: () => toast.success('Байршил устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const cols: Column<Building>[] = [
    { key: 'name', header: 'Байр', className: 'font-medium', cell: (b) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-primary/10 text-primary">
          <Building2 className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate">{b.name}</div>
          <div className="text-xs text-muted-foreground">
            {[b.block && `Блок ${b.block}`, b.entrance && `${b.entrance}р орц`].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    )},
    { key: 'floors', header: 'Давхар', className: 'text-center', accessorFn: (b) => b.floors ?? '—' },
    { key: 'apartment_count', header: 'Орц', className: 'text-center', accessorFn: (b) => b.apartment_count ?? '—' },
    { key: 'address', header: 'Хаяг', className: 'hidden md:table-cell', accessorFn: (b) => b.address ?? '—' },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', accessorFn: (b) => new Date(b.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading) return (<><PageHeader title="Байршил" icon={Building2} /><LoadingTable rows={6} cols={5} /></>)
  if (list.error) return (<><PageHeader title="Байршил" icon={Building2} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Байршил"
        description="Хотхонд байгаа бүх байр, блок, орцыг удирдах"
        icon={Building2}
        breadcrumbs={[{ label: 'Байр, Орц' }, { label: 'Байршил' }]}
        actions={<PageAction label="Шинэ байр" icon={Plus} onClick={() => setDialog('new')} />}
      />

      <DataTable<Building>
        data={filtered}
        columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        searchTerm={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Байр, блок, хаяг... хайх"
        actions={
          <Button variant="ghost" size="sm" onClick={() => toast.info('Илүү шүүлтүүр', { description: 'Шүүлтүүр товчлуур нэмэгдэнэ' })}>
            <SearchIcon className="size-4" /> Шүүлтүүр
          </Button>
        }
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'building:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <BuildingDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Building | null)}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
