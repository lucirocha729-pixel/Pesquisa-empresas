import React from 'react';
import { User } from 'firebase/auth';
import {
  Compass,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Table2,
  X,
} from 'lucide-react';
import { NavigationTab } from '../types/lead';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  user: User;
  onSignOut: () => void;
  leadsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'buscador', label: 'Buscador de Empresas', icon: Search },
  { id: 'leads', label: 'Lista de Leads', icon: Table2 },
  { id: 'crm', label: 'CRM Comercial', icon: KanbanSquare },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  user,
  onSignOut,
  leadsCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleNavigate = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const userInitial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  const content = (
    <div className="flex flex-col h-full bg-[#0A192F] text-slate-200 w-64 select-none">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-white truncate">
            Lead Finder Brasil
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {(item.id === 'leads' || item.id === 'crm') && leadsCount > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    isActive ? 'text-slate-900 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {leadsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Account Footer */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Avatar do usuário'}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/15 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {userInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {user.displayName || 'Usuário'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da conta</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 border-r border-slate-800">
        {content}
      </aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
