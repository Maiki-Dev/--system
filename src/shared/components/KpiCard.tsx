import { type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  title: string
  value: ReactNode
  hint?: string
  delta?: { value: number; label?: string; inverse?: boolean }
  icon?: LucideIcon
  accent?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'slate'
  footer?: ReactNode
  className?: string
}

const accentMap = {
  emerald: 'border-l-[hsl(158_64%_42%)] text-[hsl(158_64%_42%)]',
  sky:     'border-l-[hsl(201_90%_50%)] text-[hsl(201_90%_50%)]',
  amber:   'border-l-[hsl(38_92%_57%)] text-[hsl(38_92%_57%)]',
  rose:    'border-l-[hsl(350_89%_60%)] text-[hsl(350_89%_60%)]',
  violet:  'border-l-[hsl(262_83%_66%)] text-[hsl(262_83%_66%)]',
  slate:   'border-l-[hsl(215_16%_47%)] text-[hsl(215_16%_47%)]',
} as const

export function KpiCard({
  title, value, hint, delta, icon: Icon, accent = 'slate', footer, className,
}: KpiCardProps) {
  const positive = delta ? (delta.inverse ? delta.value < 0 : delta.value > 0) : null
  return (
    <Card className={cn('relative overflow-hidden border-l-[3px] transition hover:shadow-md', accentMap[accent], className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </CardDescription>
          <CardTitle className="flex items-baseline gap-1.5 text-2xl font-bold tracking-tight md:text-3xl">
            {value}
          </CardTitle>
        </div>
        {Icon && (
          <div className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40',
            accentMap[accent].split(' ')[1]
          )}>
            <Icon className="size-4.5" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {(hint || delta) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {delta && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium',
                positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                         : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}>
                {positive
                  ? <><ArrowUpRight className="size-3" />{Math.abs(delta.value).toFixed(1)}%</>
                  : <><ArrowDownRight className="size-3" />{Math.abs(delta.value).toFixed(1)}%</>}
                {delta.label && <span className="ml-1 opacity-80">{delta.label}</span>}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}

export function formatCurrency(n: number, currency = 'MNT') {
  return new Intl.NumberFormat('mn-MN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('mn-MN').format(n)
}

export function formatPercent(n: number) {
  return `${n.toFixed(1)}%`
}
