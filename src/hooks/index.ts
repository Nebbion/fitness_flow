import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Client, Appointment } from '@/types'

const supabase = createClient()

// ─── CLIENTS ─────────────────────────────────────────────────

export function useClients(tenantId: string, search?: string) {
  return useQuery({
    queryKey: ['clients', tenantId, search],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, full_name, email, phone, tags, active, last_appointment_at')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('full_name')
        .limit(100)

      if (search) query = query.ilike('full_name', `%${search}%`)

      const { data, error } = await query
      if (error) throw error
      return data as Client[]
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, profiles!clients_assigned_staff_id_fkey(id, full_name)')
        .eq('id', clientId)
        .single()
      if (error) throw error
      return data as Client
    },
    enabled: !!clientId,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', vars.id] })
    },
  })
}

// ─── APPOINTMENTS ─────────────────────────────────────────────

export function useAppointments(tenantId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['appointments', tenantId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/appointments?${params}`)
      if (!res.ok) throw new Error('Errore caricamento appuntamenti')
      const { data } = await res.json()
      return data as Appointment[]
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  })
}

export function useClientAppointments(clientId: string) {
  return useQuery({
    queryKey: ['appointments', 'client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`*, services(name, color), profiles!appointments_staff_id_fkey(full_name)`)
        .eq('client_id', clientId)
        .order('start_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })
}

// ─── SERVICES ─────────────────────────────────────────────────

export function useServices(tenantId: string) {
  return useQuery({
    queryKey: ['services', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── PROGRESS ─────────────────────────────────────────────────

export function useProgressEntries(clientId: string) {
  return useQuery({
    queryKey: ['progress', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_entries')
        .select('*')
        .eq('client_id', clientId)
        .order('recorded_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })
}
