import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { api } from '../lib/api'
import type { AuthRealm } from '../lib/auth'
import type { Notification } from '../types'
import { formatDate } from './StatusBadge'

type Props = {
  realm?: AuthRealm
  defaultLink?: string
  variant?: 'dark' | 'light'
}

export function NotificationBell({ realm, defaultLink = '/espace', variant = 'dark' }: Props) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', realm ?? 'auto'],
    queryFn: () => api.get<Notification[]>('/api/v1/notifications/mine', realm),
    refetchInterval: 30000,
  })

  const { data: unread } = useQuery({
    queryKey: ['notifications-unread', realm ?? 'auto'],
    queryFn: () => api.get<{ count: number }>('/api/v1/notifications/unread-count', realm),
    refetchInterval: 30000,
  })

  const markRead = useMutation({
    mutationFn: (id: number) =>
      api.patch<Notification>(`/api/v1/notifications/${id}/read`, {}, realm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/api/v1/notifications/read-all', {}, realm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const unreadCount = unread?.count ?? 0
  const buttonClass =
    variant === 'light'
      ? 'relative p-2 rounded-lg text-slate-500 hover:text-[#0055a4] hover:bg-slate-50'
      : 'relative p-1.5 rounded hover:bg-white/10'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={buttonClass}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-xl border z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
              <p className="font-semibold text-sm">Notifications</p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-[#0055a4] hover:underline"
                  >
                    Tout marquer lu
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 p-4 text-center">Aucune notification</p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    to={n.link || defaultLink}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id)
                      setOpen(false)
                    }}
                    className={`block px-4 py-3 border-b last:border-0 hover:bg-slate-50 ${
                      !n.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.created_at)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
