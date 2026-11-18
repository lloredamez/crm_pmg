'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import pmgLogo from '@/app/PMG-PNG 2.png';
import { useAuth } from '@/features/auth/auth-provider';
import { Lock, User as UserIcon, ArrowRight } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Lateral Esquerda - Imagem PMG & Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-white via-slate-50 to-orange-50/20 border-r border-slate-200/70 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Elementos decorativos de fundo sutis */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center">
          <div className="relative w-full max-w-sm flex items-center justify-center -my-10">
            <Image
              src={pmgLogo}
              alt="Logo PMG"
              priority
              className="w-full h-auto object-contain max-h-[380px] drop-shadow-sm select-none"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mt-2">Lead CRM</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-xs">
            Distribuição Inteligente com Controle de SLA
          </p>
        </div>
      </div>

      {/* Lateral Direita - Formulário de Login */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full">
          {/* Header Mobile (exibido apenas em telas menores) */}
          <div className="lg:hidden text-center mb-8">
            <div className="relative w-48 h-24 mx-auto flex items-center justify-center">
              <Image
                src={pmgLogo}
                alt="Logo PMG"
                priority
                className="w-full h-auto object-contain max-h-20 select-none"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">Lead CRM</h1>
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
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-2xl shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
              >
                {loading ? 'Autenticando...' : 'Entrar na Conta'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
