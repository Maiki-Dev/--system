import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]">
        <div className="absolute -top-24 left-1/4 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 size-96 rounded-full bg-info/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border bg-card shadow-lg">
            <div className="size-7 rounded-xl bg-gradient-to-br from-primary to-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            СӨХ Удирдах систем
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Хотхоны удирдлагын платформ
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="rounded-2xl border bg-card p-6 shadow-xl backdrop-blur sm:p-8"
        >
          <Outlet />
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} СӨХ Удирдлага. Бүх эрх хуулиар хамгаалагдсан.
        </p>
      </div>
    </div>
  )
}
