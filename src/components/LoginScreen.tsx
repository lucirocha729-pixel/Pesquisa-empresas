import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Building2, Check, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { ViraAppLogo } from './ViraAppLogo';

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('popup-closed-by-user')) {
        setError('A janela de login foi fechada antes da conclusão. Tente novamente.');
      } else {
        setError(`Não foi possível entrar: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12">
      {/* Coluna Institucional Azul Escuro */}
      <div className="lg:col-span-7 bg-gradient-to-br from-[#071426] via-[#0A192F] to-[#12305C] text-white p-8 md:p-14 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="mb-12">
            <ViraAppLogo variant="dark" size="lg" showSubtitle />
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] max-w-xl text-balance mb-6">
            Pesquisa empresarial inteligente e prospecção B2B com dados reais.
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl mb-10">
            Localize estabelecimentos por estado, cidade, bairro e segmento no Google Maps, identifique negócios sem site informado e conduza toda a negociação no CRM do VIRA APP.
          </p>

          <div className="space-y-4 max-w-lg border-t border-white/15 pt-8">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-relaxed">
                Integração direta com a <strong className="font-semibold text-white">Google Places API (New)</strong> protegida no servidor, sem exposição de chaves no navegador.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-relaxed">
                Classificação transparente de oportunidades sem website informado, pronta para verificação e abordagem comercial.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-relaxed">
                CRM persistente no Firestore para gerenciar etapas, datas de contato, observações e exportação em CSV e Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/15 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Conformidade com os Termos do Google Maps Platform
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-300" />
            VIRA APP – Pesquisa de Empresas
          </span>
        </div>
      </div>

      {/* Coluna de Acesso */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <ViraAppLogo variant="light" size="md" showSubtitle />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#0A192F] mb-2 font-display">
              Acessar VIRA APP
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Entre com sua conta Google para sincronizar suas pesquisas, leads e histórico comercial com segurança.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
              />
            </svg>
            <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
          </button>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed">
            Seus registros de CRM ficam isolados na sua conta via Firebase Authentication e regras de segurança por usuário no Firestore.
          </p>
        </div>
      </div>
    </div>
  );
}
