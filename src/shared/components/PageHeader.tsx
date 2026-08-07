import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, description, icon: Icon, actions, breadcrumbs, className, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-4 pb-2', className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard">Нүүр</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <BreadcrumbItem key={idx}>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  {isLast || !bc.href ? (
                    <BreadcrumbPage>{bc.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={bc.href}>{bc.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/60 text-primary">
              <Icon className="size-5" />
            </div>
          )}
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <Separator className="my-1" />
    </div>
  )
})

export function PageAction({
  label,
  onClick,
  to,
  variant = 'default',
  icon: Icon,
}: {
  label: string
  onClick?: () => void
  to?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  icon?: LucideIcon
}) {
  if (to) {
    return (
      <Button asChild variant={variant}>
        <Link to={to}>
          {Icon && <Icon data-icon="inline-start" />}
          {label}
        </Link>
      </Button>
    )
  }
  return (
    <Button variant={variant} onClick={onClick}>
      {Icon && <Icon data-icon="inline-start" />}
      {label}
    </Button>
  )
}
