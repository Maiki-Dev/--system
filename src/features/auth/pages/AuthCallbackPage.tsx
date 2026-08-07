import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/shared/services/supabase'
import { toast } from 'sonner'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const handle = async () => {
      const hash = window.location.hash
      if (hash.includes('type=recovery') || hash.includes('type=invite') || hash.includes('type=magiclink')) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: new URLSearchParams(hash.slice(1)).get('token_hash') ?? '',
          type: 'magiclink',
        })
        if (!mounted) return
        if (error) {
          toast.error(error.message)
          navigate('/auth/login', { replace: true })
          return
        }
        if (data.user) {
          toast.success('Амжилттай нэвтэрлээ')
          navigate('/dashboard', { replace: true })
          return
        }
      }
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (data.user) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/auth/login', { replace: true })
      }
    }
    void handle()
    return () => { mounted = false }
  }, [navigate])

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Spinner className="size-8 text-primary" />
      <div className="text-center">
        <h3 className="font-semibold">Нэвтрэлтийг баталгаажуулж байна</h3>
        <p className="mt-1 text-sm text-muted-foreground">Хийхгүй жамсахгүй байх ёстой...</p>
      </div>
    </div>
  )
}
