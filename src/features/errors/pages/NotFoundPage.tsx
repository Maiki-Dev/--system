import { Link } from 'react-router-dom'
import { ArrowLeft, Home, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden p-6">
      <div className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, currentColor 0, transparent 50%), radial-gradient(circle at 80% 80%, currentColor 0, transparent 50%)',
        }}
        aria-hidden
      />
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 bg-primary/5 text-primary ring-1 ring-primary/20">
          <SearchX className="size-10" strokeWidth={1.8} />
        </div>

        <div className="space-y-3">
          <p className="font-mono text-6xl font-black tracking-tighter text-primary md:text-7xl">404</p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Хуудас олдсонгүй
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            Таны хайж буй хуудас устгагдсан, зөөгдсөн эсвэл хэзээ ч байгаагүй болно.
            Хаягаа шалгаад дахин оролдоно уу.
          </p>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="default" size="lg" className="w-full sm:w-auto">
            <Link to="/dashboard">
              <Home className="size-4" />
              Нүүр хуудасруу буцах
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="#" onClick={() => window.history.back()}>
              <ArrowLeft className="size-4" />
              Өмнөх хуудас
            </Link>
          </Button>
        </div>

        <div className="w-full rounded-xl border bg-card/60 p-5 text-left shadow-sm backdrop-blur">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Тусламж: Илүү шалгах зүйлс
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
              Хаяган URL-ыг зөв бичсэнээ шалгана уу
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
              Браузерын cache-г цэвэрлэж дахин оролдно уу
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
              Админ руу хандсан бол эрх зөв байгаа эсэхийг шалгана уу
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
