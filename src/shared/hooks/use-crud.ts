import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/shared/services/supabase'
import { useAuth } from '@/shared/hooks/use-auth'
import type { Database } from '@/shared/types/database'

type TableName = keyof Database['public']['Tables']

export interface ListParams {
  page?: number
  pageSize?: number
  order?: { column: string; ascending?: boolean }
  filters?: Array<{ column: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is'; value: unknown }>
  select?: string
}

export interface ListResult<T> {
  data: T[]
  count: number
}

type AnyRow = Record<string, unknown>
type Json = Record<string, unknown>

export function useTableList<T extends TableName>(
  table: T,
  params: ListParams & { organizationScoped?: boolean } = {},
  options?: Omit<UseQueryOptions<ListResult<AnyRow>, PostgrestError>, 'queryKey' | 'queryFn'>,
) {
  const { organizationId } = useAuth()
  const { organizationScoped = true, page = 1, pageSize = 25, order, filters, select } = params

  return useQuery<ListResult<AnyRow>, PostgrestError>({
    queryKey: [table, 'list', organizationId, { page, pageSize, order, filters, select }],
    queryFn: async () => {
      const col = select ?? '*'
      let q = supabase.from(table as string).select(col, { count: 'exact' })

      if (organizationScoped && organizationId) {
        q = q.eq('organization_id', organizationId)
      }
      if (filters) {
        for (const f of filters) {
          const op = f.op as 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is'
          const caller = (q as unknown as Record<typeof op, (c: string, v: unknown) => typeof q>)[op]
          if (caller) q = caller(f.column, f.value)
        }
      }
      if (order) {
        q = q.order(order.column, { ascending: order.ascending ?? false })
      }
      q = q.range((page - 1) * pageSize, page * pageSize - 1)

      const res = await q
      if (res.error) throw res.error
      return { data: (res.data as AnyRow[]) ?? [], count: res.count ?? 0 }
    },
    enabled: options?.enabled !== false && (!organizationScoped || !!organizationId),
    ...options,
  })
}

export function useTableRow<T extends TableName>(
  table: T,
  id: string | null | undefined,
  select = '*',
  options?: Omit<UseQueryOptions<AnyRow | null, PostgrestError>, 'queryKey' | 'queryFn' | 'enabled'> & { enabled?: boolean },
) {
  return useQuery<AnyRow | null, PostgrestError>({
    queryKey: [table, 'row', id, select],
    queryFn: async () => {
      if (!id) return null
      const res = await supabase
        .from(table as string)
        .select(select)
        .eq('id', id)
        .maybeSingle()
      if (res.error) throw res.error
      return res.data == null ? null : (res.data as unknown as AnyRow)
    },
    enabled: options?.enabled !== false && !!id,
    ...options,
  })
}

function asPromise<T>(p: PromiseLike<T> | Promise<T>): Promise<T> {
  return Promise.resolve(p)
}

export function useTableInsert<T extends TableName>(
  table: T,
  options?: Omit<UseMutationOptions<unknown, PostgrestError, Record<string, unknown> & { logAction?: string }>, 'mutationFn'>,
) {
  const queryClient = useQueryClient()
  const { user, organizationId } = useAuth()

  return useMutation<unknown, PostgrestError, Record<string, unknown> & { logAction?: string }>({
    mutationFn: async (payload) => {
      const insert: Record<string, unknown> = { ...payload }
      if (organizationId && !insert.organization_id) insert.organization_id = organizationId
      if (user && !insert.created_by) insert.created_by = user.id
      const res = await supabase.from(table as string).insert(insert as never).select().single()
      if (res.error) throw res.error
      if (payload.logAction && user) {
        const entityId = (res.data as { id?: string } | null)?.id
        void asPromise(supabase.from('activity_logs').insert({
          organization_id: organizationId ?? undefined,
          profile_id: user.id,
          action: payload.logAction,
          entity_type: table as string,
          entity_id: entityId,
          new_value: (res.data as unknown) as Json,
        } as never)).then(() => void 0).catch(() => void 0)
      }
      return res.data
    },
    onSuccess: async (data, vars, ctx) => {
      await queryClient.invalidateQueries({ queryKey: [table], type: 'all' })
      ;(options?.onSuccess as unknown as (d: unknown, v: typeof vars, c: unknown) => void)?.(data, vars, ctx)
    },
    ...options,
  })
}

export function useTableUpdate<T extends TableName>(
  table: T,
  options?: Omit<UseMutationOptions<unknown, PostgrestError, { id: string; payload: Record<string, unknown>; logAction?: string }>, 'mutationFn'>,
) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation<unknown, PostgrestError, { id: string; payload: Record<string, unknown>; logAction?: string }>({
    mutationFn: async ({ id, payload, logAction }) => {
      const update: Record<string, unknown> = { ...payload }
      if (user) update.updated_by = user.id
      update.updated_at = new Date().toISOString()
      const res = await supabase
        .from(table as string)
        .update(update as never)
        .eq('id', id)
        .select()
        .single()
      if (res.error) throw res.error
      if (logAction && user) {
        void asPromise(supabase.from('activity_logs').insert({
          profile_id: user.id,
          action: logAction,
          entity_type: table as string,
          entity_id: id,
          new_value: (res.data as unknown) as Json,
        } as never)).then(() => void 0).catch(() => void 0)
      }
      return res.data
    },
    onSuccess: async (data, vars, ctx) => {
      await queryClient.invalidateQueries({ queryKey: [table], type: 'all' })
      ;(options?.onSuccess as unknown as (d: unknown, v: typeof vars, c: unknown) => void)?.(data, vars, ctx)
    },
    ...options,
  })
}

export function useTableDelete<T extends TableName>(
  table: T,
  options?: Omit<UseMutationOptions<void, PostgrestError, { id: string; soft?: boolean; logAction?: string }>, 'mutationFn'>,
) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation<void, PostgrestError, { id: string; soft?: boolean; logAction?: string }>({
    mutationFn: async ({ id, soft = true, logAction }) => {
      if (soft) {
        const update: Record<string, unknown> = { deleted_at: new Date().toISOString() }
        if (user) update.updated_by = user.id
        const res = await supabase.from(table as string).update(update as never).eq('id', id)
        if (res.error) throw res.error
      } else {
        const res = await supabase.from(table as string).delete().eq('id', id)
        if (res.error) throw res.error
      }
      if (logAction && user) {
        void asPromise(supabase.from('activity_logs').insert({
          profile_id: user.id,
          action: logAction,
          entity_type: table as string,
          entity_id: id,
        } as never)).then(() => void 0).catch(() => void 0)
      }
    },
    onSuccess: async (_data, vars, ctx) => {
      await queryClient.invalidateQueries({ queryKey: [table], type: 'all' })
      ;(options?.onSuccess as unknown as (d: void, v: typeof vars, c: unknown) => void)?.(undefined, vars, ctx)
    },
    ...options,
  })
}
