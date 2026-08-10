import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate('/auth/login', { replace: true })
    }, 600)
    return () => window.clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Spinner className="size-8 text-primary" />
      <div className="text-center">
        <h3 className="font-semibold">Шилжүүлж байна</h3>
        <p className="mt-1 text-sm text-muted-foreground">Нэвтрэх хуудас руу</p>
      </div>
    </div>
  )
}
