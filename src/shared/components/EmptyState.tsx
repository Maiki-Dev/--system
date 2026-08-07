import type { ComponentType } from 'react'
import { FileSearch } from 'lucide-react'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'

export function EmptyState({
  title = 'Өгөгдөл байхгүй байна',
  description = 'Хайлтын үр дүн эсвэл энд өгөгдөл олдсонгүй.',
  icon: Icon = FileSearch,
  action,
}: {
  title?: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  action?: { label: string; onClick: () => void }
}) {
  return (
    <Empty className="min-h-[320px] rounded-lg border border-dashed py-12">
      <EmptyMedia variant="icon">
        <Icon className="size-6 text-muted-foreground" />
      </EmptyMedia>
      <EmptyContent>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        {action && (
          <div className="mt-4">
            <Button onClick={action.onClick} variant="outline">{action.label}</Button>
          </div>
        )}
      </EmptyContent>
    </Empty>
  )
}

export function ErrorState({
  message = 'Өгөгдөл татахад алдаа гарлаа',
  error,
  retry,
}: {
  message?: string
  error?: Error | null
  retry?: () => void
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center">
      <p className="font-semibold text-destructive">{message}</p>
      {error && <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>}
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>Дахин оролдох</Button>
      )}
    </div>
  )
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function LoadingTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border">
      <div className="flex border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-4 flex-1 animate-pulse rounded bg-muted" style={{ marginRight: c < cols - 1 ? 12 : 0 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center border-b px-4 py-3 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 animate-pulse rounded bg-muted" style={{ marginRight: c < cols - 1 ? 12 : 0 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
