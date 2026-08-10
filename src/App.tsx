import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/shared/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'
import type { UserRole } from '@/shared/types'
import { USER_ROLES } from '@/shared/types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (e: unknown) => {
        const msg =
          e instanceof Error
            ? e.message
            : e && typeof e === 'object' && 'message' in e
              ? String((e as { message: unknown }).message ?? e)
              : typeof e === 'string'
                ? e
                : JSON.stringify(e)
        console.error('[Query Error]', msg, e)
      },
    },
    mutations: {
      onError: (e: unknown) => {
        const msg =
          e instanceof Error
            ? e.message
            : e && typeof e === 'object' && 'message' in e
              ? String((e as { message: unknown }).message ?? e)
              : typeof e === 'string'
                ? e
                : JSON.stringify(e)
        console.error('[Query Error]', msg, e)
      },
    },
  },
})

const lazyPage = (importFn: () => Promise<{ default: ComponentType<object> }>) => {
  const Comp = lazy(importFn)
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">Уншиж байна...</p>
        </div>
      </div>
    }>
      <Comp />
    </Suspense>
  )
}

const LoginPage = () => lazyPage(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = () => lazyPage(() => import('@/features/auth/pages/RegisterPage'))
const AuthCallbackPage = () => lazyPage(() => import('@/features/auth/pages/AuthCallbackPage'))

const DashboardPage = () => lazyPage(() => import('@/features/dashboard/pages/DashboardPage'))
const BuildingsPage = () => lazyPage(() => import('@/features/buildings/pages/BuildingsPage'))
const ApartmentsPage = () => lazyPage(() => import('@/features/apartments/pages/ApartmentsPage'))
const ResidentsPage = () => lazyPage(() => import('@/features/residents/pages/ResidentsPage'))
const PaymentsPage = () => lazyPage(() => import('@/features/payments/pages/PaymentsPage'))
const InvoicesPage = () => lazyPage(() => import('@/features/payments/pages/InvoicesPage'))
const ParkingPage = () => lazyPage(() => import('@/features/parking/pages/ParkingPage'))
const VisitorsPage = () => lazyPage(() => import('@/features/visitors/pages/VisitorsPage'))
const ComplaintsPage = () => lazyPage(() => import('@/features/complaints/pages/ComplaintsPage'))
const MaintenancePage = () => lazyPage(() => import('@/features/maintenance/pages/MaintenancePage'))
const AnnouncementsPage = () => lazyPage(() => import('@/features/announcements/pages/AnnouncementsPage'))
const SettingsPage = () => lazyPage(() => import('@/features/settings/pages/SettingsPage'))
const NotFoundPage = () => lazyPage(() => import('@/features/errors/pages/NotFoundPage'))

const AppLayout = lazy(() => import('@/layouts/AppLayout'))
const AuthLayout = lazy(() => import('@/layouts/AuthLayout'))

function RoleGuard({ children, minRank }: { children: ReactNode; minRank: UserRole | number }) {
  const { roleRank, isLoading } = useAuth()
  const required = typeof minRank === 'number' ? minRank : USER_ROLES[minRank].rank

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }
  if (roleRank < required) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/auth/login" replace />
  }
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <GuestOnly>
            <Suspense fallback={<Spinner />}>
              <AuthLayout />
            </Suspense>
          </GuestOnly>
        }
      >
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="callback" element={<AuthCallbackPage />} />
      </Route>

      <Route
        path="/"
        element={
          <AuthGuard>
            <Suspense fallback={<Spinner />}>
              <AppLayout />
            </Suspense>
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="buildings" element={<RoleGuard minRank="manager"><BuildingsPage /></RoleGuard>} />
        <Route path="apartments" element={<RoleGuard minRank="manager"><ApartmentsPage /></RoleGuard>} />
        <Route path="residents" element={<RoleGuard minRank="manager"><ResidentsPage /></RoleGuard>} />

        <Route path="invoices" element={<RoleGuard minRank="accountant"><InvoicesPage /></RoleGuard>} />
        <Route path="payments" element={<RoleGuard minRank="accountant"><PaymentsPage /></RoleGuard>} />

        <Route path="parking" element={<ParkingPage />} />
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={150}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  )
}
