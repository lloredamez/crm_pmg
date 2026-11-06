'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { notificationSound } from '@/lib/sound';

interface ToastNotification {
  id: string;
  type: 'assigned' | 'reassigned' | 'sla_warning' | 'new_lead' | 'esteira_full';
  title: string;
  message: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  toasts: ToastNotification[];
  removeToast: (id: string) => void;
  isSoundEnabled: boolean;
  toggleSound: () => boolean;
  playNotificationSound: () => void;
  playUrgentAlertSound: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  toasts: [],
  removeToast: () => {},
  isSoundEnabled: true,
  toggleSound: () => true,
  playNotificationSound: () => {},
  playUrgentAlertSound: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    setIsSoundEnabled(notificationSound.isEnabled());
    const unsubscribe = notificationSound.subscribe((enabled) => {
      setIsSoundEnabled(enabled);
    });
    return unsubscribe;
  }, []);

  const toggleSound = useCallback(() => {
    const newState = notificationSound.toggle();
    setIsSoundEnabled(newState);
    return newState;
  }, []);

  const playNotificationSound = useCallback(() => {
    notificationSound.playNotification();
  }, []);

  const playUrgentAlertSound = useCallback(() => {
    notificationSound.playUrgentAlert();
  }, []);

  const addToast = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...notification, id };
    setToasts((prev) => [newToast, ...prev]);

    // Auto remove after 6 seconds
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5052';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (typeof window !== 'undefined') {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id) {
              socketInstance.emit('join_attendant', { user_id: parsed.id });
            }
          } catch (_) {}
        }
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Evento disparado quando um lead é atribuído ao atendente atual
    socketInstance.on('lead:assigned', (data: any) => {
      if (data?.is_esteira_full) {
        addToast({
          type: 'esteira_full',
          title: '🚨 Urgência: Esteira Cheia!',
          message: `Sua esteira atingiu a capacidade máxima (${data.active_count || data.max_leads}/${data.max_leads || 10} leads). Tabule seus atendimentos pendentes!`,
        });
        notificationSound.playUrgentAlert();
      } else {
        addToast({
          type: 'assigned',
          title: '🎯 Novo Lead Atribuído (SLA Ativo)',
          message: `Lead ${data.name || 'Novo Lead'} atribuído a você!`,
        });
        notificationSound.playNotification();
      }
    });

    // Evento específico disparado quando a esteira do atendente enche
    socketInstance.on('esteira:full', (data: any) => {
      addToast({
        type: 'esteira_full',
        title: '🚨 Urgência: Esteira Cheia!',
        message: `Sua esteira atingiu o limite de ${data.max_leads || 10} leads sem tabulação. Tabule seus atendimentos pendentes!`,
      });
      notificationSound.playUrgentAlert();
    });

    // Evento disparado quando qualquer lead novo é criado no sistema (para administradores / supervisores)
    socketInstance.on('lead:created', (data: any) => {
      if (typeof window !== 'undefined') {
        const storedUser = sessionStorage.getItem('user');
        let currentUserId = '';
        let role = '';
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            currentUserId = parsed?.id || '';
            role = parsed?.role || '';
          } catch (_) {}
        }

        // Notificação visual no sistema para administradores / supervisores / gerentes
        // Somente visual (o som toca exclusivamente quando um lead entra na esteira do atendente via lead:assigned)
        const isAssignedToMe = data.current_attendant_id === currentUserId;
        if (!isAssignedToMe && role && role !== 'attendant') {
          addToast({
            type: 'new_lead',
            title: '📥 Novo Lead no Sistema',
            message: `${data.name || 'Novo Lead'} (${data.campaign_name || data.channel_code || 'Geral'})`,
          });
        }
      }
    });

    socketInstance.on('lead:timeout_removed', () => {
      addToast({
        type: 'sla_warning',
        title: '⚠️ Lead Realocado por Estouro de SLA',
        message: `Um lead foi redirecionado para outro atendente por tempo limite.`,
      });
    });

    socketInstance.on('lead:reassigned', (data: any) => {
      addToast({
        type: 'reassigned',
        title: '🔄 Lead Reatribuído',
        message: `Lead ${data.name || ''} foi transferido.`,
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [addToast, removeToast]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        toasts,
        removeToast,
        isSoundEnabled,
        toggleSound,
        playNotificationSound,
        playUrgentAlertSound,
      }}
    >
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const isUrgent = toast.type === 'esteira_full';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto text-white rounded-2xl p-4 shadow-xl flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
                isUrgent
                  ? 'bg-rose-950/95 border-2 border-rose-500 shadow-rose-900/40 ring-2 ring-rose-500/20'
                  : 'bg-slate-900 border border-indigo-500/30'
              }`}
            >
              <div>
                <h4 className={`font-semibold text-sm ${isUrgent ? 'text-rose-200 font-bold' : 'text-indigo-300'}`}>
                  {toast.title}
                </h4>
                <p className={`text-xs mt-1 ${isUrgent ? 'text-rose-100' : 'text-slate-300'}`}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </SocketContext.Provider>
  );
};
