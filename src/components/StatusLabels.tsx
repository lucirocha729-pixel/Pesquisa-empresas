import React from 'react';
import {
  CheckCircle2,
  CircleDot,
  Clock,
  Globe,
  GlobeLock,
  MessageSquare,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { CrmStatus, WebsiteClassification } from '../types/lead';

export const CRM_STATUS_META: Record<
  CrmStatus,
  {
    label: string;
    shortLabel: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  novo: {
    label: 'Novo',
    shortLabel: 'Novo',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
  contatado: {
    label: 'Contatado',
    shortLabel: 'Contatado',
    textColor: 'text-blue-800',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  interessado: {
    label: 'Interessado',
    shortLabel: 'Interessado',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  cliente: {
    label: 'Cliente',
    shortLabel: 'Cliente',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  descartado: {
    label: 'Descartado',
    shortLabel: 'Descartado',
    textColor: 'text-slate-500',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
};

export function CrmStatusIndicator({ status }: { status: CrmStatus }) {
  const meta = CRM_STATUS_META[status] || CRM_STATUS_META.novo;

  const renderIcon = () => {
    switch (status) {
      case 'novo':
        return <CircleDot className="w-3.5 h-3.5 shrink-0" />;
      case 'contatado':
        return <MessageSquare className="w-3.5 h-3.5 shrink-0" />;
      case 'interessado':
        return <Clock className="w-3.5 h-3.5 shrink-0" />;
      case 'cliente':
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      case 'descartado':
        return <XCircle className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${meta.bgColor} ${meta.textColor} ${meta.borderColor}`}
    >
      {renderIcon()}
      <span>{meta.label}</span>
    </span>
  );
}

export function WebsiteClassificationIndicator({
  classification,
}: {
  classification: WebsiteClassification;
}) {
  if (classification === 'SEM_SITE_INFORMADO_GOOGLE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded border bg-emerald-50 text-emerald-800 border-emerald-200 whitespace-nowrap">
        <GlobeLock className="w-3.5 h-3.5 shrink-0" />
        <span>SEM SITE INFORMADO NO GOOGLE</span>
      </span>
    );
  }

  if (classification === 'VERIFICADO_SEM_SITE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded border bg-emerald-100 text-emerald-900 border-emerald-300 whitespace-nowrap">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>Verificado sem site</span>
      </span>
    );
  }

  if (classification === 'VERIFICADO_COM_SITE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap">
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span>Verificado com site</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap">
      <Globe className="w-3.5 h-3.5 shrink-0" />
      <span>Site informado no Google</span>
    </span>
  );
}
