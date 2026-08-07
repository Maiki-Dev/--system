import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, ArrowRight, EyeOff, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/shared/hooks/use-auth'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email({ message: 'Зөв имэйл хаяг оруулна уу' }),
  password: z.string().min(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байна' }),
})

type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setLoading(true)
    try {
      await signIn(data.email, data.password)
      toast.success('Амжилттай нэвтэрлээ')
      navigate('/dashboard', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Нэвтрэх амжилтгүй боллоо'
      form.setError('root', { message: msg })
    } finally {
      setLoading(false)
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Нэвтрэх</h2>
        <p className="text-sm text-muted-foreground">Имэйл болон Google-ээр нэвтэрнэ үү</p>
      </div>

      {rootError && (
        <Alert variant="destructive">
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field
          name="email"
          invalid={!!form.formState.errors.email}
        >
          <FieldLabel>Имэйл хаяг</FieldLabel>
          <InputGroup>
            <Mail className="size-4 text-muted-foreground" />
            <InputGroupInput
              type="email"
              placeholder="name@example.mn"
              autoComplete="email"
              {...form.register('email')}
            />
          </InputGroup>
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field
          name="password"
          invalid={!!form.formState.errors.password}
        >
          <div className="flex items-center justify-between">
            <FieldLabel>Нууц үг</FieldLabel>
            <Link
              to="#"
              onClick={(e) => { e.preventDefault(); toast.info('Нууц үг сэргээх функц бусдаас болно.') }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Нууц үг мартсан?
            </Link>
          </div>
          <InputGroup>
            <Lock className="size-4 text-muted-foreground" />
            <InputGroupInput
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              {...form.register('password')}
            />
            <InputGroupAddon asChild padded>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <span className="animate-spin">◌</span>}
        Нэвтрэх
        <ArrowRight data-icon="inline-end" className="size-4" />
      </Button>

      <div className="grid gap-2">
        <div className="relative py-1">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            эсвэл
          </span>
        </div>
        {/* Social auth options are currently disabled to avoid repeated email-provider calls. */}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Шинэ хэрэглэгч?{' '}
        <Link to="/auth/register" className="font-medium text-primary hover:underline">
          Бүртгүүлэх <ArrowRight className="inline size-3.5" />
        </Link>
      </p>
    </form>
  )
}
