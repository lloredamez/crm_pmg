'use client';

import React, { useState } from 'react';
import { User } from '@/features/leads/types';
import { useAuth } from '@/features/auth/auth-provider';
import { ShieldCheck, UserCheck, Headset, UserPlus, Mail, Lock, CheckCircle2 } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  onRefresh: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onRefresh }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('attendant');
  const [maxLeads, setMaxLeads] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5052';

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          max_simultaneous_leads: Number(maxLeads),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao cadastrar usuário');
      }

      setMessage(`Usuário ${name} cadastrado com sucesso!`);
      setName('');
      setEmail('');
      setPassword('');
      onRefresh();
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (r: string) => {
    if (r === 'admin') {
      return (
        <span className="badge-purple">
          <ShieldCheck className="w-3 h-3" /> Admin
        </span>
      );
    }
    if (r === 'supervisor') {
      return (
        <span className="badge-mint">
          <UserCheck className="w-3 h-3" /> Supervisor
        </span>
      );
    }
    return (
      <span className="badge-slate">
        <Headset className="w-3 h-3" /> Atendente
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Gerenciamento de Equipe & Perfis</h2>
          <p className="text-xs text-slate-400">Cadastre e administre administradores, supervisores e atendentes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Create User */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Integrante</h3>
          </div>

          {message && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-2xl mb-4 font-medium">
              {message}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                placeholder="Ex: Pedro Henrique"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
              <input
                type="email"
                required
                placeholder="pedro@crmleads.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Inicial</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil / Nível de Acesso</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="attendant">🎧 Atendente (Atendimento e Leads próprios)</option>
                <option value="supervisor">👔 Supervisor (Gestão de Fila e SLA)</option>
                <option value="admin">👑 Administrador (Acesso Total)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidade Máxima Leads Simultâneos</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm shadow-brand-500/20 transition-all"
            >
              {loading ? 'Cadastrando...' : 'Salvar Novo Integrante'}
            </button>
          </form>
        </div>

        {/* List of Users */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Integrantes Ativos na Plataforma ({users.length})</h3>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Nome / E-mail</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Capacidade SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{u.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-semibold ${
                        u.status === 'online' ? 'text-emerald-600' : u.status === 'busy' ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {u.status === 'online' ? '🟢 Online' : u.status === 'busy' ? '🟡 Ocupado' : '⚪ Offline'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{u.max_simultaneous_leads} leads</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
