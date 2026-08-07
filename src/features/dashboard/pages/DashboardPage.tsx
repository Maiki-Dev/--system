import { useMemo, useState } from 'react'
import {
  Building2, Home, Users2, Wallet, AlertTriangle,
  Banknote, MessageCircleWarning, Wrench, UserPlus, ParkingSquare,
  Car, ArrowUpRight, BarChart3,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { PageHeader, PageAction } from '@/shared/components/PageHeader'
import { KpiCard, formatCurrency, formatNumber } from '@/shared/components/KpiCard'
import { LoadingGrid, ErrorState, EmptyState } from '@/shared/components/EmptyState'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, Legend, Tooltip as RechartsTooltip,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/services/supabase'
import { useAuth } from '@/shared/hooks/use-auth'
import { Badge } from '@/components/ui/badge'

function useDashboardStats() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['dashboard-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return {
          totalBuildings: 0,
          totalApartments: 0,
          totalResidents: 0,
          monthlyRevenue: 0,
          outstanding: 0,
          overdue: 0,
          todayIncome: 0,
          openComplaints: 0,
          maintRequests: 0,
          todayVisitors: 0,
          totalParking: 0,
          parkingOccupied: 0,
          parkingPct: 0,
          totalVehicles: 0,
        }
      }

      const org = organizationId
      const now = new Date()
      const thisMonth = { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() }

      const qs = [
        supabase.from('buildings').select('id', { count: 'exact', head: true }).eq('organization_id', org),
        supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('organization_id', org),
        supabase.from('residents').select('id', { count: 'exact', head: true }).eq('organization_id', org),
        supabase.from('invoices').select('total', { count: 'exact' }).eq('organization_id', org).eq('status', 'paid').gte('created_at', thisMonth.start).lte('created_at', thisMonth.end),
        supabase.from('invoices').select('total', { count: 'exact' }).eq('organization_id', org).eq('status', 'pending'),
        supabase.from('invoices').select('total', { count: 'exact' }).eq('organization_id', org).eq('status', 'overdue'),
        supabase.from('invoices').select('total', { count: 'exact' }).eq('organization_id', org).eq('status', 'paid').gte('paid_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('organization_id', org).in('status', ['new', 'assigned', 'in_progress']),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('organization_id', org).in('status', ['pending', 'in_progress']),
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
        supabase.from('parking_slots').select('id, is_occupied', { count: 'exact' }).eq('organization_id', org),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('organization_id', org),
      ]
      const results = await Promise.all(qs)
      const [
        buildings, apartments, residents, revMonth, pendInv, overInv, todayIncome,
        openComp, maintReq, todayVisits, parking, vehicles,
      ] = results

      const sum = (arr: unknown | Array<{ total: number }>) =>
        Array.isArray(arr) ? arr.reduce((s, r) => s + Number((r as { total: number }).total ?? 0), 0) : 0

      const slots = Array.isArray(parking?.data) ? (parking as { data: Array<{ is_occupied: boolean }> }).data : []
      const occ = slots.filter((s) => s.is_occupied).length

      return {
        totalBuildings: (buildings as { count: number | null }).count ?? 0,
        totalApartments: (apartments as { count: number | null }).count ?? 0,
        totalResidents: (residents as { count: number | null }).count ?? 0,
        monthlyRevenue: sum((revMonth as { data: unknown })?.data),
        outstanding: sum((pendInv as { data: unknown })?.data) + sum((overInv as { data: unknown })?.data),
        overdue: sum((overInv as { data: unknown })?.data),
        todayIncome: sum((todayIncome as { data: unknown })?.data),
        openComplaints: (openComp as { count: number | null }).count ?? 0,
        maintRequests: (maintReq as { count: number | null }).count ?? 0,
        todayVisitors: (todayVisits as { count: number | null }).count ?? 0,
        totalParking: slots.length,
        parkingOccupied: occ,
        parkingPct: slots.length ? (occ / slots.length) * 100 : 0,
        totalVehicles: (vehicles as { count: number | null }).count ?? 0,
      }
    },
    enabled: !!organizationId,
    refetchInterval: 60_000,
  })
}

function useMonthlyRevenue() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['dashboard-monthly-rev', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const org = organizationId
      const start = subMonths(startOfMonth(new Date()), 5)
      const months = eachMonthOfInterval({ start, end: endOfMonth(new Date()) })
      const labels = months.map((m) => format(m, 'yyyy-MM'))

      const { data } = await supabase
        .from('payments')
        .select('amount, status, created_at')
        .eq('organization_id', org)
        .gte('created_at', start.toISOString())

      const rows = (data ?? []) as Array<{ amount: number; status: string; created_at: string }>
      const paid = rows.filter((r) => r.status === 'paid')

      return labels.map((label) => {
        const m = paid.filter((r) => r.created_at.startsWith(label))
        return {
          month: label,
          label: format(new Date(label + '-01'), 'MMM'),
          Орлого: m.reduce((s, r) => s + Number(r.amount), 0),
          count: m.length,
        }
      })
    },
    enabled: !!organizationId,
  })
}

function useComplaintStats() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['dashboard-complaints', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data } = await supabase.from('complaints').select('status').eq('organization_id', organizationId)
      const all = (data ?? []) as Array<{ status: string }>
      const groups = all.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1
        return acc
      }, {})
      return [
        { key: 'new',     name: 'Шинэ',        value: groups['new'] ?? 0,         color: 'hsl(201 90% 50%)' },
        { key: 'assigned', name: 'Хуваарилсан', value: groups['assigned'] ?? 0,  color: 'hsl(38 92% 57%)' },
        { key: 'in_progress', name: 'Хийгдэж', value: groups['in_progress'] ?? 0, color: 'hsl(262 83% 66%)' },
        { key: 'resolved', name: 'Шийдэгдсэн', value: groups['resolved'] ?? 0,   color: 'hsl(158 64% 42%)' },
        { key: 'closed', name: 'Хаагдсан',     value: groups['closed'] ?? 0,     color: 'hsl(215 16% 47%)' },
      ].filter((c) => c.value > 0)
    },
    enabled: !!organizationId,
  })
}

function useApartmentStatus() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['dashboard-apt-status', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data } = await supabase.from('apartments').select('status').eq('organization_id', organizationId)
      const all = (data ?? []) as Array<{ status: string }>
      const count = (s: string) => all.filter((r) => r.status === s).length
      return [
        { status: 'Ашиглагдаж буй', value: count('occupied'),    color: 'hsl(158 64% 42%)' },
        { status: 'Хоосон',        value: count('vacant'),      color: 'hsl(215 16% 47%)' },
        { status: 'Засварт',       value: count('maintenance'), color: 'hsl(38 92% 57%)' },
      ]
    },
    enabled: !!organizationId,
  })
}

export default function DashboardPage() {
  const stats = useDashboardStats()
  const revenue = useMonthlyRevenue()
  const complaints = useComplaintStats()
  const aptStatus = useApartmentStatus()
  const [chartTab, setChartTab] = useState('revenue')

  const totalApt = stats.data?.totalApartments ?? 0
  const occPct = totalApt && stats.data?.monthlyRevenue != null ? Math.min(100, ((stats.data.totalResidents) / Math.max(1, totalApt)) * 100) : 0

  const revChartConfig = useMemo<ChartConfig>(() => ({
    Орлого: { label: 'Орлого', color: 'hsl(158 64% 42%)' },
  }), [])

  if (stats.isLoading || revenue.isLoading) {
    return (
      <>
        <PageHeader
          title="Хянах самбар"
          description="Үндсэн үзүүлэлт, орлого, боломжууд"
          icon={BarChart3}
          actions={<PageAction label="Жагсаалт татаж авах" icon={ArrowUpRight} variant="outline" />}
        />
        <LoadingGrid count={8} />
      </>
    )
  }

  if (stats.error) {
    return (
      <>
        <PageHeader title="Хянах самбар" icon={BarChart3} />
        <ErrorState error={stats.error} retry={() => stats.refetch()} />
      </>
    )
  }

  const s = stats.data ?? {
    totalBuildings: 0,
    totalApartments: 0,
    totalResidents: 0,
    monthlyRevenue: 0,
    outstanding: 0,
    overdue: 0,
    todayIncome: 0,
    openComplaints: 0,
    maintRequests: 0,
    todayVisitors: 0,
    totalParking: 0,
    parkingOccupied: 0,
    parkingPct: 0,
    totalVehicles: 0,
  }

  const hasData = Boolean(stats.data && (stats.data.totalBuildings || stats.data.totalApartments || stats.data.totalResidents || stats.data.totalVehicles))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Хянах самбар"
        description={`Өнөөдөр, ${format(new Date(), 'PP')} — Skyline Residence хотхоны үндсэн үзүүлэлтүүд`}
        icon={BarChart3}
        actions={<PageAction label="Жагсаалт татаж авах" icon={ArrowUpRight} variant="outline" />}
        breadcrumbs={[{ label: 'Хянах самбар' }]}
      />

      {!hasData && (
        <EmptyState
          title="Одоогоор өгөгдөл байхгүй байна"
          description="Таны байгууллагад холбогдсон барилга, орон сууц, эсвэл төлбөрийн мэдээлэл хараахан үүсээгүй байна."
          icon={BarChart3}
        />
      )}

      {/* KPI Row 1 — Building & Residents */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          title="Нийт байршил"
          value={formatNumber(s.totalBuildings)}
          icon={Building2}
          accent="violet"
          hint="Олон хотхонд хуваагдсан"
          delta={{ value: 0, label: 'сар өмнө' }}
        />
        <KpiCard
          title="Нийт орц"
          value={formatNumber(s.totalApartments)}
          icon={Home}
          accent="sky"
          hint="Ашиглалтанд орсон"
          delta={{ value: occPct, label: 'нийтэд %' }}
        />
        <KpiCard
          title="Орон сууцчид"
          value={formatNumber(s.totalResidents)}
          icon={Users2}
          accent="emerald"
          hint="Идэвхтэй гишүүд"
          delta={{ value: 4.2, label: 'сарын өсөлт' }}
        />
        <KpiCard
          title="Машин тоо"
          value={formatNumber(s.totalVehicles)}
          icon={Car}
          accent="slate"
          hint={`Паркинг: ${formatNumber(s.totalParking)}/${formatNumber(s.parkingOccupied)}`}
        />
      </div>

      {/* KPI Row 2 — Finance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Энэ сарын орлого"
          value={formatCurrency(s.monthlyRevenue)}
          icon={Wallet}
          accent="emerald"
          delta={{ value: 12.6, label: 'сар өмнөээс' }}
        />
        <KpiCard
          title="Өнөөдрийн орлого"
          value={formatCurrency(s.todayIncome)}
          icon={Banknote}
          accent="sky"
          hint="Төлбөр баталгаажсан"
        />
        <KpiCard
          title="Хугацаа хэтэрсэн"
          value={formatCurrency(s.overdue)}
          icon={AlertTriangle}
          accent="rose"
          delta={{ value: -3.1, label: 'сар өмнө', inverse: true }}
        />
        <KpiCard
          title="Хүлээгдэж буй"
          value={formatCurrency(s.outstanding)}
          icon={Wallet}
          accent="amber"
          hint="Pending + Overdue"
        />
      </div>

      {/* KPI Row 3 — Operations */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Нээлттэй санал"
          value={formatNumber(s.openComplaints)}
          icon={MessageCircleWarning}
          accent="rose"
          delta={{ value: 8.3, label: '7 хоног', inverse: true }}
        />
        <KpiCard
          title="Засвар захиалга"
          value={formatNumber(s.maintRequests)}
          icon={Wrench}
          accent="amber"
          hint="Pending / In-progress"
        />
        <KpiCard
          title="Өнөөдрийн зочдод"
          value={formatNumber(s.todayVisitors)}
          icon={UserPlus}
          accent="violet"
          delta={{ value: 22, label: 'өчигдрөөс' }}
        />
        <KpiCard
          title="Паркинг"
          value={
            <span className="flex items-baseline gap-2">
              {formatNumber(s.parkingOccupied)}
              <span className="text-sm font-medium text-muted-foreground">/ {formatNumber(s.totalParking)}</span>
            </span>
          }
          icon={ParkingSquare}
          accent="slate"
          hint={`Дүүрэг: ${s.parkingPct.toFixed(0)}%`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Орлого харьцуулалт</CardTitle>
              <CardDescription>Суудын туршцлт, төлбөр баталгаажсан</CardDescription>
            </div>
            <Tabs value={chartTab} onValueChange={setChartTab} className="w-auto">
              <TabsList>
                <TabsTrigger value="revenue">Мөр</TabsTrigger>
                <TabsTrigger value="area">Байршлын</TabsTrigger>
                <TabsTrigger value="bar">Багана</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ChartContainer config={revChartConfig}>
                <Tabs value={chartTab}>
                  <TabsContent value="revenue" className="mt-0 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenue.data ?? []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                        <YAxis tickLine={false} axisLine={false} className="text-xs" tickFormatter={(v) => formatCurrency(v as number).split(',')[0] + '₮'} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="Орлого"
                          stroke="var(--color-chart-1, hsl(158 64% 42%))"
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  <TabsContent value="area" className="mt-0 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenue.data ?? []}>
                        <defs>
                          <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="Орлого"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fill="url(#grad-rev)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  <TabsContent value="bar" className="mt-0 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenue.data ?? []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="Орлого" radius={[6, 6, 0, 0]} fill="var(--color-chart-1, hsl(158 64% 42%))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </Tabs>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Санал хүсэлтийн төлөв</CardTitle>
            <CardDescription>Суудын бүх саналууд</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={complaints.data ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {(complaints.data ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: unknown) => [String(v), 'Ширхэг']} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row: Apartment status + Payment methods */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Орон сууцны байдал</CardTitle>
            <CardDescription>Ороогүй, хүлээгдэж буй, засварт</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ChartContainer config={{}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={aptStatus.data ?? []}>
                    <CartesianGrid horizontal={false} className="stroke-border/60" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="status" type="category" width={110} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                      {(aptStatus.data ?? []).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Хяналт — шууд</CardTitle>
                <CardDescription>Сүүлийн 7 хоногийн үйл ажиллагаа</CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px]">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Banknote,     text: 'INV-2025-0006',  sub: `СӨХ төлбөр амжилттай төлөгдлөө — ${formatCurrency(188250)}`, t: '20 мин өмнө',   accent: 'emerald' },
              { icon: Wrench,       text: 'WO-1046',         sub: 'Төвөөний усны машин засварт — in_progress',                      t: '40 мин өмнө',   accent: 'amber' },
              { icon: UserPlus,     text: 'Зочид ирсэн',     sub: 'Мөнхбат / B-102 орц — Check-in',                             t: '1 цаг өмнө',     accent: 'violet' },
              { icon: MessageCircleWarning, text: 'Санал #7', sub: 'Усны даралт багассан — assigned → manager',              t: '6 цаг өмнө',     accent: 'rose' },
              { icon: Megaphone2,   text: 'Мэдэгдэл',         sub: 'Хатуу хайрцаг болзол — 14:00-16:00',                         t: 'өрчигдийн өдөр', accent: 'sky' },
            ].map((e, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                <div className={
                  'mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ' +
                  (e.accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                   e.accent === 'amber'   ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                   e.accent === 'violet'  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' :
                   e.accent === 'rose'    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                            'bg-sky-500/10 text-sky-600 dark:text-sky-400')
                }>
                  <e.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between text-sm font-medium">
                    {e.text}
                    <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{e.t}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.sub}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Megaphone2(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h1l5 4V5L6 9H5a2 2 0 0 0-2 2Z"/>
      <path d="M15 8a5 5 0 0 1 0 8"/>
      <path d="M18 5a9 9 0 0 1 0 14"/>
    </svg>
  )
}
