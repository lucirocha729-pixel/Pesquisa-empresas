import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Loader2, Menu } from 'lucide-react';
import { BuscadorView } from './components/BuscadorView';
import { CrmView } from './components/CrmView';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { LeadsTableView } from './components/LeadsTableView';
import { LoginScreen } from './components/LoginScreen';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { ViraAppLogo } from './components/ViraAppLogo';
import {
  ensureUserProfile,
  subscribeToCrmLeads,
  subscribeToSearchLogs,
} from './lib/crmService';
import { auth } from './lib/firebase';
import { fetchApiConfigStatus } from './lib/placesApi';
import {
  CrmLead,
  NavigationTab,
  PlaceSearchResult,
  SearchLog,
} from './types/lead';

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Indicadores de prospecção e conversão do funil',
  },
  buscador: {
    title: 'Buscador de Empresas',
    subtitle: 'Pesquisa por localização e segmento via Google Places API (New)',
  },
  leads: {
    title: 'Lista de Leads',
    subtitle: 'Base do CRM, status de website e exportação CSV / Excel',
  },
  crm: {
    title: 'CRM Comercial',
    subtitle: 'Gestão de etapas, datas de contato e histórico de negociação',
  },
  configuracoes: {
    title: 'Configurações',
    subtitle: 'Integração segura no servidor e conformidade de API',
  },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [placesCache, setPlacesCache] = useState<Record<string, PlaceSearchResult>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    totalSearched: 0,
    withoutWebsite: 0,
    withWebsite: 0,
  });

  useEffect(() => {
    const handleQuotaEvent = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaEvent);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaEvent);
  }, []);

  useEffect(() => {
    if (authLoading) {
      document.title = 'VIRA APP – Pesquisa de Empresas';
      return;
    }
    if (!user) {
      document.title = 'VIRA APP – Pesquisa de Empresas | Acesso';
      return;
    }
    document.title = `VIRA APP – Pesquisa de Empresas | ${TAB_TITLES[activeTab].title}`;
  }, [authLoading, user, activeTab]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch (err) {
          console.error('Erro ao garantir perfil de usuário:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setLeads([]);
      setSearchLogs([]);
      return;
    }

    const unsubLeads = subscribeToCrmLeads(user.uid, setLeads);
    const unsubLogs = subscribeToSearchLogs(user.uid, setSearchLogs);

    fetchApiConfigStatus()
      .then((info) => setApiConfigured(info.placesApiConfigured))
      .catch(() => setApiConfigured(null));

    return () => {
      unsubLeads();
      unsubLogs();
    };
  }, [user]);

  const handleCachePlaces = useCallback((places: PlaceSearchResult[]) => {
    if (places.length === 0) return;
    setPlacesCache((prev) => {
      const next = { ...prev };
      for (const p of places) {
        next[p.placeId] = p;
      }
      return next;
    });
  }, []);

  const handleSessionSearchRecorded = useCallback(
    (stats: { total: number; withoutWebsite: number; withWebsite: number }) => {
      setSessionStats((prev) => ({
        totalSearched: prev.totalSearched + stats.total,
        withoutWebsite: prev.withoutWebsite + stats.withoutWebsite,
        withWebsite: prev.withWebsite + stats.withWebsite,
      }));
    },
    []
  );

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 px-4">
        <ViraAppLogo variant="light" size="lg" showSubtitle />
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Carregando VIRA APP – Pesquisa de Empresas...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!user ? (
        <LoginScreen />
      ) : (
        <div className="min-h-screen bg-slate-50 flex">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            user={user}
            onSignOut={() => signOut(auth)}
            leadsCount={leads.length}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Bar */}
            <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Abrir menu lateral"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                  aria-label="Ir para o início do VIRA APP"
                >
                  <ViraAppLogo variant="light" size="sm" showSubtitle={false} />
                </button>
                <span className="hidden sm:block h-6 w-px bg-slate-200 shrink-0" aria-hidden="true" />
                <div className="hidden sm:block min-w-0">
                  <h1 className="text-base md:text-lg font-bold text-slate-900 truncate font-display">
                    {TAB_TITLES[activeTab].title}
                  </h1>
                  <p className="hidden md:block text-xs text-slate-500 truncate">
                    {TAB_TITLES[activeTab].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {activeTab !== 'buscador' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('buscador')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                  >
                    Buscar empresas
                  </button>
                )}
              </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 p-4 md:p-8 max-w-[1440px] w-full mx-auto">
              {activeTab === 'dashboard' && (
                <DashboardView
                  leads={leads}
                  searchLogs={searchLogs}
                  sessionStats={sessionStats}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'buscador' && (
                <BuscadorView
                  userId={user.uid}
                  savedLeads={leads}
                  apiConfigured={apiConfigured}
                  onCachePlaces={handleCachePlaces}
                  onSessionSearchRecorded={handleSessionSearchRecorded}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'leads' && (
                <LeadsTableView
                  userId={user.uid}
                  leads={leads}
                  placesCache={placesCache}
                  onCachePlaces={handleCachePlaces}
                  onOpenLeadDetail={(lead) => setSelectedLeadId(lead.id)}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'crm' && (
                <CrmView
                  userId={user.uid}
                  leads={leads}
                  placesCache={placesCache}
                  onOpenLeadDetail={(lead) => setSelectedLeadId(lead.id)}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'configuracoes' && (
                <SettingsView onStatusUpdated={setApiConfigured} />
              )}
            </main>

            {/* Rodapé Institucional */}
            <footer className="border-t border-slate-200 bg-white/80 px-4 md:px-8 py-4">
              <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <span>VIRA APP – Pesquisa de Empresas</span>
                </div>
                <div>
                  Inteligência comercial, prospecção B2B e CRM integrado
                </div>
              </div>
            </footer>
          </div>

          <LeadDetailDrawer
            userId={user.uid}
            lead={selectedLead}
            livePlace={selectedLead ? placesCache[selectedLead.placeId] : undefined}
            onCachePlaces={handleCachePlaces}
            onClose={() => setSelectedLeadId(null)}
          />
        </div>
      )}
    </ErrorBoundary>
  );
}
