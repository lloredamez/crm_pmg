'use client';

import React, { useState, useEffect } from 'react';
import { createMockLead } from '@/features/leads/api';
import { fetchChannels } from '@/features/channels/api';
import { Channel } from '@/features/leads/types';
import { X, Zap, Globe } from 'lucide-react';

interface SimulateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SimulateLeadModal: React.FC<SimulateLeadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channelCode, setChannelCode] = useState('WEBSITE');
  const [campaign, setCampaign] = useState('Campanha Webhook Inbound');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchChannels(true)
        .then((data) => {
          if (data && data.length > 0) {
            setChannels(data);
            if (!data.some((c) => c.code === channelCode)) {
              setChannelCode(data[0].code);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, channelCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    setLoading(true);
    try {
      await createMockLead({
        name,
        phone,
        campaign_name: campaign,
        channel_code: channelCode
      });
      setName('');
      setPhone('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Simular Ingestão de Webhook</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Dispara um evento de webhook simulando uma nova entrada de lead para o canal selecionado. O motor de Round-Robin fará a distribuição inteligente aos atendentes disponíveis.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              Canal de Entrada (Webhook)
            </label>
            <select
              value={channelCode}
              onChange={(e) => setChannelCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
            >
              {channels.length > 0 ? (
                channels.map((ch) => (
                  <option key={ch.id} value={ch.code}>
                    {ch.name} ({ch.code})
                  </option>
                ))
              ) : (
                <>
                  <option value="WEBSITE">Site / Landing Page (WEBSITE)</option>
                  <option value="WHATSAPP_DIRECT">WhatsApp Direct (WHATSAPP_DIRECT)</option>
                  <option value="GOOGLE_ADS">Google Ads (GOOGLE_ADS)</option>
                  <option value="META_ADS">Meta Ads (META_ADS)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Lead</label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Eduardo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
            <input
              type="text"
              required
              placeholder="Ex: 11988887777"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Campanha / Origem</label>
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-brand-500/20"
            >
              {loading ? 'Processando Ingestão...' : 'Disparar Ingestão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
