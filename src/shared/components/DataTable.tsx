import { useMemo, type ReactNode } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  header: string
  accessorFn?: (row: T) => ReactNode
  cell?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

export interface DataTableProps<T extends { id: string }> {
  title?: string
  description?: string
  data: T[]
  columns: Column<T>[]
  totalCount?: number | undefined
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  searchTerm?: string | undefined
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  actions?: ReactNode
  rowActions?: (row: T) => ReactNode
  emptyState?: ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({
  title, description, data, columns, totalCount,
  page, pageSize, onPageChange,
  searchTerm, onSearchChange, searchPlaceholder = 'Хайх...',
  actions, rowActions, emptyState, className,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil((totalCount ?? data.length) / pageSize))
  const pageRange = useMemo(() => computePageRange(page, totalPages), [page, totalPages])

  const isEmpty = data.length === 0 && !searchTerm
  const isFilteredEmpty = data.length === 0 && !!searchTerm

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(title || actions || onSearchChange) && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {onSearchChange && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 sm:w-64"
                />
              </div>
            )}
            {actions}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isEmpty || isFilteredEmpty ? (
            <div className="p-6">
              {emptyState ?? (
                <EmptyState
                  title={isFilteredEmpty ? 'Хайлтын үр дүн байхгүй' : 'Жагсаалт хоосон'}
                  description={isFilteredEmpty ? 'Өөр түлхүүр үгээр хайлтаа оролдоно уу.' : 'Шинэ бичлэг нэмэх бол дээрх товчлуур ашиглана уу.'}
                />
              )}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={String(c.key)} className={cn(c.className, 'whitespace-nowrap')}>
                        <div className="flex items-center gap-2">
                          {c.header}
                          {c.sortable && <span className="text-xs text-muted-foreground">↕</span>}
                        </div>
                      </TableHead>
                    ))}
                    {rowActions && <TableHead className="text-right">Үйлдэл</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.id} className="group">
                      {columns.map((c) => {
                        const val = c.cell
                          ? c.cell(row)
                          : c.accessorFn
                            ? c.accessorFn(row)
                            : String((row as Record<string, unknown>)[String(c.key)] ?? '')
                        return (
                          <TableCell key={String(c.key)} className={cn(c.className, 'align-middle')}>
                            {val as ReactNode}
                          </TableCell>
                        )
                      })}
                      {rowActions && (
                        <TableCell className="text-right">
                          <div className="inline-flex justify-end opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            {rowActions(row)}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                aria-disabled={page <= 1}
                asChild={false}
              >
                <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} className="border-0 p-0" />
              </Button>
            </PaginationItem>
            {pageRange.map((p, idx) =>
              p === '…' ? (
                <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => { e.preventDefault(); onPageChange(p as number) }}
                    isActive={p === page}
                  >{p}</PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                aria-disabled={page >= totalPages}
              >
                <PaginationNext href="#" onClick={(e) => e.preventDefault()} className="border-0 p-0" />
              </Button>
            </PaginationItem>
            <PaginationItem className="ml-2 hidden text-sm text-muted-foreground sm:inline-flex">
              {totalCount ? `${totalCount} бичлэгийн ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)}` : `${data.length} бичлэг`}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

function computePageRange(current: number, total: number): Array<number | '…'> {
  const delta = 2
  const range: number[] = []
  const rangeWithDots: Array<number | '…'> = []
  let l: number | undefined

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i)
    }
  }

  for (const i of range) {
    if (l !== undefined) {
      if (i - l === 2) rangeWithDots.push(l + 1)
      else if (i - l > 2) rangeWithDots.push('…')
    }
    rangeWithDots.push(i)
    l = i
  }
  return rangeWithDots
}

export function useTableSearch<T extends object>(
  data: T[],
  keys: Array<keyof T>,
  query: string
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    )
  }, [data, keys, query])
}


