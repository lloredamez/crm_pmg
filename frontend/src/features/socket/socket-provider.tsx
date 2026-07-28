'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ToastNotification {
  id: string;
  type: 'assigned' | 'reassigned' | 'sla_warning';
  title: string;
  message: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  toasts: ToastNotification[];
  removeToast: (id: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  toasts: [],
  removeToast: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (notification: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...notification, id };
    setToasts((prev) => [newToast, ...prev]);

    // Auto remove after 6 seconds
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5052';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('lead:assigned', (data: any) => {
      addToast({
        type: 'assigned',
        title: '🎯 Novo Lead Atribuído (SLA Ativo)',
        message: `Lead ${data.name || 'Novo Lead'} (${data.campaign_name || 'Campanha'}) atribuído a você!`
      });
    });

    socketInstance.on('lead:timeout_removed', (data: any) => {
      addToast({
        type: 'sla_warning',
        title: '⚠️ Lead Realocado por Estouro de SLA',
        message: `Lead ${data.lead_id} foi redirecionado por tempo limite sem interação.`
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, toasts, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-indigo-500/30 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
          >
            <div>
              <h4 className="font-semibold text-sm text-indigo-300">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </SocketContext.Provider>
  );
};
