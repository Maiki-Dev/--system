import { useState } from 'react'
import { Settings as SettingsIcon, Building2, Palette, Users2, Bell, Shield, Database as DatabaseIcon } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/shared/hooks/use-auth'
import { useTableUpdate } from '@/shared/hooks/use-crud'
import type { Database } from '@/shared/types/database'
import { supabase } from '@/shared/services/supabase'
import { useQuery } from '@tanstack/react-query'

type Organization = Database['public']['Tables']['organizations']['Row']

const ORG_FORM = z.object({
  name: z.string().min(2, 'Нэр 2+ тэмдэгт'),
  registration_number: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Имэйл буруу').optional().or(z.literal('')),
  currency: z.string().optional().or(z.literal('')),
  timezone: z.string().optional().or(z.literal('')),
  primary_color: z.string().optional().or(z.literal('')),
})
type OrgForm = z.infer<typeof ORG_FORM>

const NOTIF_FORM = z.object({
  email_notifications: z.boolean().default(true),
  sms_notifications: z.boolean().default(false),
  push_notifications: z.boolean().default(true),
  payment_reminders: z.boolean().default(true),
  maintenance_alerts: z.boolean().default(true),
})
type NotifForm = z.infer<typeof NOTIF_FORM>

export default function SettingsPage() {
  const { organizationId } = useAuth()
  const [activeTab, setActiveTab] = useState('organization')

  const orgQ = useQuery({
    queryKey: ['organization-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return null
      const { data } = await supabase.from('organizations').select('*').eq('id', organizationId).maybeSingle()
      return data as Organization | null
    },
    enabled: !!organizationId,
  })

  const orgUpdate = useTableUpdate<'organizations'>('organizations')

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(ORG_FORM),
    defaultValues: {
      name: orgQ.data?.name ?? '',
      registration_number: orgQ.data?.registration_number ?? '',
      address: orgQ.data?.address ?? '',
      phone: orgQ.data?.phone ?? '',
      email: orgQ.data?.email ?? '',
      currency: orgQ.data?.currency ?? 'MNT',
      timezone: orgQ.data?.timezone ?? 'Asia/Ulaanbaatar',
      primary_color: orgQ.data?.primary_color ?? '#10b981',
    },
    values: orgQ.data ? {
      name: orgQ.data.name,
      registration_number: orgQ.data.registration_number ?? '',
      address: orgQ.data.address ?? '',
      phone: orgQ.data.phone ?? '',
      email: orgQ.data.email ?? '',
      currency: orgQ.data.currency ?? 'MNT',
      timezone: orgQ.data.timezone ?? 'Asia/Ulaanbaatar',
      primary_color: orgQ.data.primary_color ?? '#10b981',
    } : {
      name: '',
      registration_number: '',
      address: '',
      phone: '',
      email: '',
      currency: 'MNT',
      timezone: 'Asia/Ulaanbaatar',
      primary_color: '#10b981',
    },
  })

  const notifForm = useForm<NotifForm>({
    resolver: zodResolver(NOTIF_FORM) as never,
    defaultValues: {
      email_notifications: true,
      sms_notifications: false,
      push_notifications: true,
      payment_reminders: true,
      maintenance_alerts: true,
    },
  })

  const onSaveOrg = orgForm.handleSubmit(async (data) => {
    if (!orgQ.data) return
    try {
      await orgUpdate.mutateAsync({ id: orgQ.data.id, payload: data, logAction: 'org:settings:updated' })
      toast.success('Тохиргоо хадгалагдлаа')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа')
    }
  })

  const onSaveNotif = notifForm.handleSubmit(async () => {
    toast.success('Мэдэгдлийн тохиргоо хадгалагдлаа')
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Тохиргоо"
        description="Системийн тохиргоо, байгууллагын мэдээлэл, удирдамж"
        icon={SettingsIcon}
        breadcrumbs={[{ label: 'Удирдлага' }, { label: 'Тохиргоо' }]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="organization" className="gap-2"><Building2 className="size-4" />Байгууллага</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="size-4" />Харагдац</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="size-4" />Мэдэгдэл</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users2 className="size-4" />Хэрэглэгчид</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="size-4" />Хамгаалалт</TabsTrigger>
          <TabsTrigger value="system" className="gap-2"><DatabaseIcon className="size-4" />Систем</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Байгууллагын мэдээлэл</CardTitle>
              <CardDescription>Нэр, хаяг, холбоо барих мэдээлэл</CardDescription>
            </CardHeader>
            <form onSubmit={onSaveOrg}>
              <CardContent>
                <FieldGroup>
                  <Field name="name" invalid={!!orgForm.formState.errors.name}>
                    <FieldLabel>Нэр</FieldLabel>
                    <Input {...orgForm.register('name')} placeholder="Хотхоны нэр" />
                    <FieldError>{orgForm.formState.errors.name?.message}</FieldError>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="registration_number"><FieldLabel>РД</FieldLabel><Input {...orgForm.register('registration_number')} /></Field>
                    <Field name="phone"><FieldLabel>Утас</FieldLabel><Input {...orgForm.register('phone')} /></Field>
                  </div>
                  <Field name="email" invalid={!!orgForm.formState.errors.email}>
                    <FieldLabel>Имэйл</FieldLabel>
                    <Input type="email" {...orgForm.register('email')} />
                    <FieldError>{orgForm.formState.errors.email?.message}</FieldError>
                  </Field>
                  <Field name="address"><FieldLabel>Хаяг</FieldLabel><Textarea rows={2} {...orgForm.register('address')} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="currency">
                      <FieldLabel>Валют</FieldLabel>
                      <Controller
                        name="currency"
                        control={orgForm.control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="MNT">Монгол төгрөг (₮)</SelectItem>
                                <SelectItem value="USD">US Dollar ($)</SelectItem>
                                <SelectItem value="EUR">Euro (€)</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field name="timezone">
                      <FieldLabel>Цагийн бүс</FieldLabel>
                      <Controller
                        name="timezone"
                        control={orgForm.control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="Asia/Ulaanbaatar">Улаанбаатар (UTC+8)</SelectItem>
                                <SelectItem value="Asia/Shanghai">Шанхай (UTC+8)</SelectItem>
                                <SelectItem value="Europe/Berlin">Берлин (UTC+1)</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={orgUpdate.isPending}>Хадгалах</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Харагдац</CardTitle>
              <CardDescription>Өнгө, фонт, үзэгдлийн тохиргоо</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field name="primary_color"><FieldLabel>Үндсэн өнгө</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Controller
                      name="primary_color"
                      control={orgForm.control}
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Input type="color" {...field} className="h-10 w-20 p-1" />
                          <Input {...field} className="font-mono" />
                        </div>
                      )}
                    />
                  </div>
                </Field>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-sm font-medium">Бараан горим</Label>
                    <p className="text-xs text-muted-foreground">Системийг бараан өнгөтэй харагдацтай болгох</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end"><Button onClick={() => toast.success('Харагдац хадгалагдлаа')}>Хадгалах</Button></CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Мэдэгдлийн тохиргоо</CardTitle>
              <CardDescription>Ямар мэдэгдэл хүлээн авахыг сонгох</CardDescription>
            </CardHeader>
            <form onSubmit={onSaveNotif}>
              <CardContent className="space-y-3">
                {(['email_notifications', 'sms_notifications', 'push_notifications', 'payment_reminders', 'maintenance_alerts'] as const).map((k) => {
                  const labels: Record<string, { title: string; desc: string }> = {
                    email_notifications: { title: 'Имэйл мэдэгдэл', desc: 'Төлбөр, засварын гэрээгээ имэйлээр' },
                    sms_notifications: { title: 'СМС мэдэгдэл', desc: 'Яаралтай зүйлс SMS-р' },
                    push_notifications: { title: 'Push мэдэгдэл', desc: 'Вэб апп-руу шууд мэдэгдэл' },
                    payment_reminders: { title: 'Төлбөрийн сануулга', desc: 'Төлбөр дуусахаас өмнө сануулах' },
                    maintenance_alerts: { title: 'Засварын мэдэгдэл', desc: 'Засварын ажил гүйцэтгэхээс өмнө' },
                  }
                  const meta = labels[k]
                  if (!meta) return null
                  return (
                    <div key={k} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label className="text-sm font-medium">{meta.title}</Label>
                        <p className="text-xs text-muted-foreground">{meta.desc}</p>
                      </div>
                      <Controller
                        name={k}
                        control={notifForm.control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </div>
                  )
                })}
              </CardContent>
              <CardFooter className="justify-end"><Button type="submit">Хадгалах</Button></CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Хэрэглэгчид ба үүрэг</CardTitle>
              <CardDescription>Хэрэглэгчид, эрх, үүргийн удирдамж</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Хэрэглэгчид, үүрэг удирдах хуудас энд байрлана.</p>
            </CardContent>
            <CardFooter className="justify-end"><Button variant="ghost">Удирдах</Button></CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Хамгаалалт</CardTitle>
              <CardDescription>Нууц үг, 2FA, нэвтрэлтийн түүх</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-sm font-medium">2FA хандах боломж</Label>
                  <p className="text-xs text-muted-foreground">Нэвтрэхдээ хоёртын баталгаажуулалт</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-sm font-medium">Нууц үг сэргээх</Label>
                  <p className="text-xs text-muted-foreground">Тохироггүй хугацаанд сэргээхийг шаардах</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
            <CardFooter className="justify-end"><Button>Хадгалах</Button></CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Системийн тохиргоо</CardTitle>
              <CardDescription>Өгөгдлийн сан, нөөцлөлт, API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-medium">Өгөгдлийн анхдагч байдал</Label>
                <p className="mt-1 text-xs text-muted-foreground">Санхүү, төлбөрийн бүх утгыг сэргээх / устгах</p>
                <Button variant="destructive" size="sm" className="mt-3">Систем цэвэрлэх</Button>
              </div>
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-medium">Нөөцлөлт</Label>
                <p className="mt-1 text-xs text-muted-foreground">Өгөгдлийн сангийн нөөцлөлтийн тохиргоо</p>
                <Button variant="outline" size="sm" className="mt-3">Одоо нөөцлөх</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
