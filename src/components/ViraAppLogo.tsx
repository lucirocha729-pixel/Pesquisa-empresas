import React, { useState } from 'react';

interface ViraAppLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  iconOnly?: boolean;
  className?: string;
}

const LOGO_SRC = '/assets/aistudio/IMG-20261116-WA0026_97b88cf4.jpg';

const SIZE_CONFIG: Record<
  NonNullable<ViraAppLogoProps['size']>,
  {
    frame: string;
    subtitle: string;
    gap: string;
  }
> = {
  sm: {
    frame: 'h-9 w-[66px] rounded-lg',
    subtitle: 'text-[9px] tracking-[0.08em]',
    gap: 'gap-2',
  },
  md: {
    frame: 'h-12 w-[92px] rounded-xl',
    subtitle: 'text-[10px] tracking-[0.12em]',
    gap: 'gap-3',
  },
  lg: {
    frame: 'h-16 w-[124px] rounded-xl',
    subtitle: 'text-[11px] tracking-[0.12em]',
    gap: 'gap-3.5',
  },
};

export function ViraAppLogo({
  variant = 'dark',
  size = 'md',
  showSubtitle = false,
  iconOnly = false,
  className = '',
}: ViraAppLogoProps) {
  const [imgError, setImgError] = useState(false);
  const cfg = SIZE_CONFIG[size];
  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center ${cfg.gap} select-none min-w-0 ${className}`}>
      <div
        className={`${cfg.frame} bg-white shrink-0 overflow-hidden flex items-center justify-center ${
          isDark ? 'ring-1 ring-white/20 shadow-sm' : 'border border-slate-200/80'
        }`}
      >
        {!imgError ? (
          <img
            src={LOGO_SRC}
            alt="VIRA APP – Pesquisa de Empresas"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain scale-[1.24] pointer-events-none"
          />
        ) : (
          <span className="font-display font-extrabold text-sm tracking-tight text-[#0A192F] px-2">
            Vira<span className="text-emerald-600">App</span>
          </span>
        )}
      </div>

      {!iconOnly && showSubtitle && (
        <div className="min-w-0 leading-tight">
          <div
            className={`font-display font-bold tracking-tight whitespace-nowrap text-xs ${
              isDark ? 'text-white' : 'text-[#0A192F]'
            }`}
          >
            VIRA APP
          </div>
          <div
            className={`${cfg.subtitle} font-semibold uppercase mt-0.5 whitespace-nowrap truncate ${
              isDark ? 'text-blue-200/85' : 'text-slate-500'
            }`}
          >
            Pesquisa de Empresas
          </div>
        </div>
      )}
    </div>
  );
}
