import type { Metadata } from 'next';
import './globals.css';
import { ReactQueryProvider } from '@/lib/react-query';
import { SocketProvider } from '@/features/socket/socket-provider';
import { AuthProvider } from '@/features/auth/auth-provider';

export const metadata: Metadata = {
  title: 'Lead CRM System - SLA & Distribuição Inteligente',
  description: 'CRM de distribuição inteligente de leads com SLA de atendimento, login e controle por perfis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
