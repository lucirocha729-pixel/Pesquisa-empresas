import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { fetchApiConfigStatus, testPlacesApiConnection } from '../lib/placesApi';
import { ApiStatusInfo } from '../types/lead';

interface SettingsViewProps {
  onStatusUpdated: (configured: boolean) => void;
}

export function SettingsView({ onStatusUpdated }: SettingsViewProps) {
  const [status, setStatus] = useState<ApiStatusInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const info = await fetchApiConfigStatus();
      setStatus(info);
      onStatusUpdated(info.placesApiConfigured);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testPlacesApiConnection();
      setTestResult({ ok: true, message: res.message });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Falha ao testar a Google Places API (New).',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Status da API no Servidor */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Configuração segura da Google Places API (New)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              A chave da API permanece isolada no servidor Node.js/Express e nunca é enviada ao navegador.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || loadingStatus}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0A192F] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            <span>Testar conexão com Places API</span>
          </button>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verificando variáveis de ambiente no servidor...</span>
          </div>
        ) : status ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Estado da chave no servidor
                </span>
                {status.placesApiConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Configurada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    Não detectada
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 space-y-1 font-mono">
                <div>Variável ativa: {status.keySource || 'Nenhuma'}</div>
                <div>Identificador mascarado: {status.keyHint || '—'}</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Proteção e limites do proxy
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A192F]">
                  <Lock className="w-3.5 h-3.5" />
                  Server-side only
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  Endpoint: <code className="font-mono text-slate-800">places:searchText (v1)</code>
                </div>
                <div>
                  Limite de taxa configurado:{' '}
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {status.rateLimitPerMinute} req/min
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {testResult && (
          <div
            className={`rounded-lg p-4 border text-xs flex items-start gap-2.5 ${
              testResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Instruções de Secrets e Segurança */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-[#0A192F]" />
          <h3 className="text-base font-bold text-slate-900 font-display">
            Como configurar a chave com segurança
          </h3>
        </div>

        <ol className="list-decimal list-inside space-y-2.5 text-sm text-slate-600 leading-relaxed">
          <li>
            No painel de <strong>Secrets / Variáveis de Ambiente</strong> do ambiente de execução, defina{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-900">
              GOOGLE_MAPS_API_KEY
            </code>{' '}
            (ou{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-900">
              GOOGLE_PLACES_API_KEY
            </code>
            ). Nunca insira chaves em arquivos do frontend (<code className="font-mono text-xs">src/</code>).
          </li>
          <li>
            Ative a <strong>Places API (New)</strong> no seu projeto do Google Cloud Console.
          </li>
          <li>
            Restrinja a chave de API especificamente para a <strong>Places API (New)</strong> e para o ambiente autorizado conforme as recomendações oficiais do Google Cloud:{' '}
            <a
              href="https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
            >
              <span>Documentação de restrições de API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </li>
        </ol>
      </div>

      {/* Conformidade e Termos de Uso */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900 font-display">
            Conformidade com os Termos do Google Maps Platform
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          O <strong>VIRA APP – Pesquisa de Empresas</strong> foi arquitetado para respeitar as políticas de armazenamento e licenciamento do Google Maps Platform. No Firestore são persistidos exclusivamente os dados próprios do seu CRM (etapa comercial, observações, data de contato, canal, ticket e nome de referência) vinculados ao <code className="font-mono text-slate-800">placeId</code> oficial. O uso da plataforma está sujeito aos{' '}
          <a
            href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline font-medium"
          >
            Termos de Serviço do Google Maps Platform
          </a>{' '}
          e pode gerar custos na conta de faturamento do Google Cloud conforme o volume de consultas em produção.
        </p>
      </div>
    </div>
  );
}
