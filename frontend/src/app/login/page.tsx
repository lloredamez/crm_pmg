'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { Zap, ShieldCheck, UserCheck, Headset, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || 'Credenciais inválidas. Verifique seu nome, CPF ou e-mail e a senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoCred: string) => {
    setIdentifier(demoCred);
    setPassword('senha123');
    setError(null);
    setLoading(true);
    try {
      await login(demoCred, 'senha123');
    } catch (err: any) {
      setError(err.message || 'Falha no login demonstrativo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/25 mx-auto mb-3">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lead CRM</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Distribuição Inteligente com Controle de SLA</p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <h2 className="text-base font-bold text-slate-900 mb-1">Acessar Plataforma</h2>
          <p className="text-xs text-slate-400 mb-6">Informe seu Nome, CPF ou E-mail para acessar o sistema</p>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl mb-4 font-medium animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome, CPF ou E-mail</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Nome, CPF ou e-mail corporativo"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-2xl shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all mt-2"
            >
              {loading ? 'Autenticando...' : 'Entrar na Conta'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Quick Demo Login Section */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block text-center mb-3">
              Acesso Rápido por Perfil (Demo)
            </span>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('111.111.111-11')}
                className="w-full bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Carlos Admin</span>
                </div>
                <span className="text-[10px] text-slate-400">CPF: 111.111.111-11</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('Roberto Mendes')}
                className="w-full bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Roberto Mendes (Gerente)</span>
                </div>
                <span className="text-[10px] text-slate-400">CPF: 222.222.222-22</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('333.333.333-33')}
                className="w-full bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Marcos Vinícius (Supervisor)</span>
                </div>
                <span className="text-[10px] text-slate-400">CPF: 333.333.333-33</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('Ana Silva')}
                className="w-full bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Headset className="w-4 h-4 text-emerald-600" />
                  <span>Ana Silva (Atendente)</span>
                </div>
                <span className="text-[10px] text-slate-400">CPF: 444.444.444-44</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('555.555.555-55')}
                className="w-full bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Headset className="w-4 h-4 text-emerald-600" />
                  <span>Bruno Costa (Atendente)</span>
                </div>
                <span className="text-[10px] text-slate-400">CPF: 555.555.555-55</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
