import { useMemo } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Home, Users2, FileText, Wallet,
  ParkingSquare, UserPlus, MessageCircleWarning, Wrench, Megaphone, Settings,
  LogOut, Bell, Search, ChevronRight, Crown,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/shared/hooks/use-auth'
import { USER_ROLES } from '@/shared/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  minRank: number
  badge?: () => React.ReactNode
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Үндсэн',
    items: [
      { label: 'Хянах самбар', href: '/dashboard',    icon: LayoutDashboard, minRank: 0 },
    ],
  },
  {
    group: 'Байр, Орц',
    items: [
      { label: 'Байршил',       href: '/buildings',    icon: Building2,     minRank: 70 },
      { label: 'Орон сууц',     href: '/apartments',   icon: Home,          minRank: 70 },
      { label: 'Орон сууцчид',  href: '/residents',    icon: Users2,        minRank: 70 },
      { label: 'Паркинг',       href: '/parking',      icon: ParkingSquare, minRank: 10 },
      { label: 'Зочид',         href: '/visitors',     icon: UserPlus,      minRank: 10 },
    ],
  },
  {
    group: 'Санхүү, Нягтлан',
    items: [
      { label: 'Нэхэмжлэл',     href: '/invoices',     icon: FileText,       minRank: 60 },
      { label: 'Төлбөр',        href: '/payments',     icon: Wallet,         minRank: 60 },
    ],
  },
  {
    group: 'Үйл ажиллагаа',
    items: [
      { label: 'Санал хүсэлт', href: '/complaints',    icon: MessageCircleWarning, minRank: 10 },
      { label: 'Засвар ажлыг', href: '/maintenance',   icon: Wrench,              minRank: 10 },
      { label: 'Мэдэгдэл',     href: '/announcements', icon: Megaphone,           minRank: 10 },
    ],
  },
]

function UserMenu() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const initials = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .map((s) => s!.trim().charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || 'SU'

  const handleLogout = async () => {
    await signOut()
    toast.success('Амжилттай гарлаа')
    navigate('/auth/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 data-[state=open]:bg-accent">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-col items-start text-left lg:flex">
            <span className="truncate text-sm font-medium">
              {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Хэрэглэгч'}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {role ? USER_ROLES[role].labelMn : 'Үүрэггүй'}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Хэрэглэгч'}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {role ? USER_ROLES[role].labelMn : ''}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="size-4" />
            Тохиргоо
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="size-4" />
          Гарах
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavSection() {
  const { roleRank, hasMinRank } = useAuth()
  const location = useLocation()
  const { state } = useSidebar()

  const visibleGroups = useMemo(() => NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.minRank === 0 || hasMinRank(i.minRank)),
  })).filter((g) => g.items.length > 0), [roleRank, hasMinRank])

  return (
    <>
      {visibleGroups.map((g) => (
        <SidebarGroup key={g.group}>
          {state === 'expanded' && <SidebarGroupLabel>{g.group}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {g.items.map((item) => {
                const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <NavLink to={item.href} className={cn('group flex items-center gap-2', active && 'font-medium')}>
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.badge && item.badge()}
                        <ChevronRight className="ml-auto size-3 opacity-0 transition group-data-[active=true]:opacity-100" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

export default function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" className="data-[active=true]:bg-transparent">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-md">
                    <Crown className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold">СӨХ Удирдлага</span>
                    <span className="truncate text-[11px] text-muted-foreground">Enterprise</span>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="scrollbar-thin">
          <NavSection />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Тохиргоо">
                <NavLink to="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  <span>Тохиргоо</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex h-screen min-h-screen flex-col bg-muted/20">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-5" />
          </div>

          <div className="hidden flex-1 items-center md:flex">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Орон сууцчин, төлбөр, санал хүсэлт... хайх" className="w-full bg-muted/50 pl-9" />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 items-center gap-0.5 rounded border bg-background px-1.5 text-[10px] text-muted-foreground sm:flex">
                <span>Ctrl</span><span>+</span><span>K</span>
              </kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative" aria-label="Мэдэгдэл">
              <Bell className="size-4.5" />
              <Badge className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center p-0 text-[10px]">3</Badge>
            </Button>
            <UserMenu />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
