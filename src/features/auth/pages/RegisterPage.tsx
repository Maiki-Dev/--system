import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, UserCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/shared/hooks/use-auth'
import { toast } from 'sonner'

const schema = z
  .object({
    firstName: z.string().min(2, 'Нэр дор хаяж 2 тэмдэгт'),
    lastName:  z.string().min(2, 'Овог дор хаяж 2 тэмдэгт'),
    email:     z.string().email('Зөв имэйл хаяг оруулна уу'),
    password:  z.string().min(6, 'Нууц үг 6+ тэмдэгт'),
    confirm:   z.string().min(6, 'Нууц үг давтах'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Нууц үг таарахгүй байна',
    path: ['confirm'],
  })

type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirm: '' },
  })

  const onSubmit = form.handleSubmit(async (d) => {
    setLoading(true)
    try {
      await signUp(d.email, d.password, d.firstName, d.lastName)
      toast.success('Бүртгэл үүслээ. Имэйл баталгаажуулна уу.')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    } catch (e: unknown) {
      form.setError('root', { message: e instanceof Error ? e.message : 'Бүртгүүлэхэд алдаа' })
    } finally {
      setLoading(false)
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Бүртгүүлэх</h2>
        <p className="text-sm text-muted-foreground">Системд анх удаа нэвтэрч буй уу?</p>
      </div>

      {rootError && (
        <Alert variant="destructive">
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field name="lastName" invalid={!!form.formState.errors.lastName}>
            <FieldLabel>Овог</FieldLabel>
            <InputGroup>
              <UserCircle className="size-4 text-muted-foreground" />
              <InputGroupInput placeholder="Батболд" {...form.register('lastName')} />
            </InputGroup>
            <FieldError>{form.formState.errors.lastName?.message}</FieldError>
          </Field>
          <Field name="firstName" invalid={!!form.formState.errors.firstName}>
            <FieldLabel>Нэр</FieldLabel>
            <InputGroup>
              <UserCircle className="size-4 text-muted-foreground" />
              <InputGroupInput placeholder="Эрдэнэ" {...form.register('firstName')} />
            </InputGroup>
            <FieldError>{form.formState.errors.firstName?.message}</FieldError>
          </Field>
        </div>

        <Field name="email" invalid={!!form.formState.errors.email}>
          <FieldLabel>Имэйл хаяг</FieldLabel>
          <InputGroup>
            <Mail className="size-4 text-muted-foreground" />
            <InputGroupInput type="email" placeholder="name@example.mn" {...form.register('email')} />
          </InputGroup>
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field name="password" invalid={!!form.formState.errors.password}>
          <FieldLabel>Нууц үг</FieldLabel>
          <InputGroup>
            <Lock className="size-4 text-muted-foreground" />
            <InputGroupInput
              type={show ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              {...form.register('password')}
            />
          </InputGroup>
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field name="confirm" invalid={!!form.formState.errors.confirm}>
          <FieldLabel>Нууц үг давтах</FieldLabel>
          <InputGroup>
            <Lock className="size-4 text-muted-foreground" />
            <InputGroupInput
              type={show ? 'text' : 'password'}
              placeholder="••••••••"
              {...form.register('confirm')}
            />
            <InputGroupAddon asChild padded>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <FieldError>{form.formState.errors.confirm?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <span className="animate-spin">◌</span>}
        Бүртгүүлэх
        <ArrowRight data-icon="inline-end" className="size-4" />
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Бүртгэлтэй юу?{' '}
        <Link to="/auth/login" className="font-medium text-primary hover:underline">
          Нэвтрэх <ArrowRight className="inline size-3.5" />
        </Link>
      </p>
    </form>
  )
}
