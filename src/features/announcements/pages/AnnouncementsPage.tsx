import { useMemo, useState } from 'react'
import { Plus, Megaphone, MoreHorizontal, Pencil, Trash2, Pin, Calendar, User } from 'lucide-react'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { DataTable, useTableSearch, type Column } from '@/shared/components/DataTable'
import { LoadingTable, ErrorState } from '@/shared/components/EmptyState'
import { AnnouncementTypeBadge } from '@/shared/components/StatusBadges'
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
import { useTableList, useTableInsert, useTableUpdate, useTableDelete } from '@/shared/hooks/use-crud'
import { ANNOUNCEMENT_TYPE, type AnnouncementType } from '@/shared/types'
import type { Database } from '@/shared/types/database'

type Announcement = Database['public']['Tables']['announcements']['Row']

const FORM = z.object({
  type: z.enum(['news', 'emergency', 'maintenance']),
  title: z.string().min(3, 'Гарчиг 3+ тэмдэгт'),
  body: z.string().min(5, 'Агуулга 5+ тэмдэгт'),
  is_pinned: z.boolean(),
  scheduled_at: z.string().optional().or(z.literal('')),
  published_at: z.string().optional().or(z.literal('')),
})
type Form = z.infer<typeof FORM>

function AnnouncementDialog({
  open, value, onClose,
}: {
  open: boolean
  value: Announcement | null
  onClose: () => void
}) {
  const isEdit = !!value
  const form = useForm<Form>({
    resolver: zodResolver(FORM),
    defaultValues: value
      ? {
          type: value.type as AnnouncementType,
          title: value.title,
          body: value.body,
          is_pinned: value.is_pinned,
          scheduled_at: value.scheduled_at ? value.scheduled_at.slice(0, 16) : '',
          published_at: value.published_at ? value.published_at.slice(0, 16) : '',
        }
      : {
          type: 'news',
          title: '',
          body: '',
          is_pinned: false,
        },
  })

  const insert = useTableInsert<'announcements'>('announcements')
  const update = useTableUpdate<'announcements'>('announcements')

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Partial<Announcement> = {
      ...(data as Partial<Announcement>),
      scheduled_at: data.scheduled_at ? data.scheduled_at : null,
      published_at: data.published_at ? data.published_at : null,
    }
    try {
      if (isEdit && value) {
        await update.mutateAsync({ id: value.id, payload, logAction: 'announcement:updated' })
        toast.success('Мэдэгдэл шинэчлэгдлээ')
      } else {
        await insert.mutateAsync({ ...payload, logAction: 'announcement:created' })
        toast.success('Мэдэгдэл нийтлэгдлээ')
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
          <DialogTitle>{isEdit ? 'Мэдэгдэл засах' : 'Шинэ мэдэгдэл нийтлэх'}</DialogTitle>
          <DialogDescription>Орон сууцчид руу мэдэгдэл, зарлал явуулах</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
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
                          {(Object.keys(ANNOUNCEMENT_TYPE) as AnnouncementType[]).map((t) => (
                            <SelectItem key={t} value={t}>{ANNOUNCEMENT_TYPE[t].labelMn}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">Дээд талд зөвшөнөх</Label>
                    <p className="text-xs text-muted-foreground">Түүхэн дээр үлдэх эсэх</p>
                  </div>
                  <Controller
                    name="is_pinned"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
              </div>
            </div>
            <Field name="title" invalid={!!form.formState.errors.title}>
              <FieldLabel>Гарчиг</FieldLabel>
              <Input {...form.register('title')} placeholder="Шатгайн засварын тухай мэдэгдэл..." />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field name="body" invalid={!!form.formState.errors.body}>
              <FieldLabel>Агуулга</FieldLabel>
              <Textarea rows={6} {...form.register('body')} placeholder="Орон сууцчид дамжуулах мэдэгдлийн агуулга..." />
              <FieldError>{form.formState.errors.body?.message}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="scheduled_at"><FieldLabel>Төлөвлөсөн огноо</FieldLabel><Input type="datetime-local" {...form.register('scheduled_at')} /></Field>
              <Field name="published_at"><FieldLabel>Нийтлэгдсэн огноо</FieldLabel><Input type="datetime-local" {...form.register('published_at')} /></Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Цуцлах</Button>
            <Button type="submit" disabled={insert.isPending || update.isPending}>
              {isEdit ? 'Хадгалах' : 'Нийтлэх'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AnnouncementsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Announcement | null | 'new'>(null)

  const list = useTableList<'announcements'>('announcements', {
    page, pageSize: 10, order: { column: 'created_at' },
    filters: [{ column: 'deleted_at', op: 'is', value: null }],
  })

  const rows = useMemo<Announcement[]>(() => (list.data?.data as Announcement[]) ?? [], [list.data])
  const filtered = useTableSearch<Announcement>(rows, ['title', 'body', 'type'], search)

  const remove = useTableDelete<'announcements'>('announcements', {
    onSuccess: () => toast.success('Мэдэгдэл устгагдлаа'),
    onError: (e) => toast.error(e.message),
  })

  const cols: Column<Announcement>[] = [
    { key: 'title', header: 'Мэдэгдэл', className: 'font-medium', cell: (a) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-secondary text-primary">
          <Megaphone className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate">{a.title}</div>
            {a.is_pinned && <Badge variant="default" className="shrink-0 bg-amber-500"><Pin className="mr-1 size-3" />Зөвшөнөх</Badge>}
          </div>
          <div className="mt-0.5 line-clamp-1 truncate text-xs text-muted-foreground">{a.body}</div>
        </div>
      </div>
    )},
    { key: 'type', header: 'Төрөл', cell: (a) => <AnnouncementTypeBadge type={a.type as AnnouncementType} /> },
    { key: 'published_at', header: 'Нийтлэгдсэн', className: 'hidden md:table-cell', cell: (a) => a.published_at
      ? <span className="inline-flex items-center gap-1 text-xs"><Calendar className="size-3 text-muted-foreground" />{a.published_at.slice(0, 10)}</span>
      : <Badge variant="outline" className="text-xs">Хүлээгдэж буй</Badge>
    },
    { key: 'created_by', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', cell: (a) => a.created_by
      ? <span className="inline-flex items-center gap-1 text-xs"><User className="size-3 text-muted-foreground" />#{a.created_by.slice(0, 6)}</span>
      : '—'
    },
    { key: 'created_at', header: 'Үүсгэсэн', className: 'hidden lg:table-cell', accessorFn: (a) => new Date(a.created_at).toLocaleDateString('mn-MN') },
  ]

  if (list.isLoading) {
    return (<><PageHeader title="Мэдэгдэл" icon={Megaphone} /><LoadingTable rows={6} cols={5} /></>)
  }
  if (list.error) {
    return (<><PageHeader title="Мэдэгдэл" icon={Megaphone} /><ErrorState error={list.error} retry={() => list.refetch()} /></>)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Мэдэгдэл"
        description="Орон сууцчид руу мэдэгдэл, зарлал, өдөр тутмын мэдээ"
        icon={Megaphone}
        breadcrumbs={[{ label: 'Удирдлага' }, { label: 'Мэдэгдэл' }]}
        actions={<PageAction label="Шинэ мэдэгдэл" icon={Plus} onClick={() => setDialog('new')} />}
      />
      <DataTable<Announcement>
        data={filtered} columns={cols}
        totalCount={search ? filtered.length : list.data?.count}
        page={page} pageSize={10} onPageChange={setPage}
        searchTerm={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Гарчиг, агуулга... хайх"
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog(row)}><Pencil className="size-4" /> Засах</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => remove.mutate({ id: row.id, logAction: 'announcement:deleted' })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Устгах
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <AnnouncementDialog
        open={dialog !== null}
        value={dialog === 'new' ? null : (dialog as Announcement | null)}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
