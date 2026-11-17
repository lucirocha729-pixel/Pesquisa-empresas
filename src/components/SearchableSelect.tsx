import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

export interface SelectOptionItem {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  id: string;
  label: string;
  value: string;
  options: SelectOptionItem[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
  allowClear?: boolean;
  clearLabel?: string;
  required?: boolean;
  hideSearch?: boolean;
  allowCustomValue?: boolean;
  // Modo remoto opcional (ex: consulta sob demanda de bairros ao digitar/abrir)
  onSearchQueryChange?: (query: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
  filterLocally?: boolean;
}

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Digite para pesquisar...',
  disabled = false,
  disabledPlaceholder,
  loading = false,
  loadingText = 'Carregando opções...',
  error = null,
  onRetry,
  emptyText = 'Nenhuma opção encontrada.',
  allowClear = false,
  clearLabel = 'Deixar vazio (cidade inteira)',
  required = false,
  hideSearch = false,
  allowCustomValue = false,
  onSearchQueryChange,
  onOpenChange,
  filterLocally = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const displayLabel = useMemo(() => {
    if (disabled && disabledPlaceholder && !value) {
      return disabledPlaceholder;
    }
    if (selectedOption) return selectedOption.label;
    if (value) return value;
    return placeholder;
  }, [disabled, disabledPlaceholder, selectedOption, value, placeholder]);

  const filteredOptions = useMemo(() => {
    if (!filterLocally || !searchTerm.trim()) return options;
    const q = normalizeText(searchTerm.trim());
    return options.filter((opt) => {
      const target = normalizeText(`${opt.label} ${opt.value} ${opt.sublabel || ''}`);
      return target.includes(q);
    });
  }, [options, searchTerm, filterLocally]);

  const trimmedSearch = searchTerm.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedSearch) return true;
    const q = normalizeText(trimmedSearch);
    return options.some(
      (opt) => normalizeText(opt.value) === q || normalizeText(opt.label) === q
    );
  }, [options, trimmedSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen && !hideSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    } else if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, hideSearch]);

  const toggleOpen = () => {
    if (disabled) return;
    const next = !isOpen;
    setIsOpen(next);
    onOpenChange?.(next);
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    onSearchQueryChange?.(text);
  };

  const showClearButton = allowClear && Boolean(value) && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-emerald-700 ml-0.5">*</span>}
      </label>

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-required={required}
          className={`w-full h-10 pl-3 text-left text-sm rounded-lg border flex items-center justify-between gap-2 transition-colors ${
            showClearButton ? 'pr-14' : 'pr-9'
          } ${
            disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              : isOpen
                ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 cursor-pointer'
                : 'bg-white border-slate-300 hover:border-slate-400 text-slate-900 cursor-pointer'
          }`}
        >
          <span className={`truncate ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
            {displayLabel}
          </span>
        </button>

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          ) : (
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                disabled ? 'text-slate-300' : 'text-slate-500'
              } ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </div>

        {showClearButton && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('');
            }}
            aria-label={`Limpar ${label}`}
            title="Limpar seleção"
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Campo de busca dentro do dropdown */}
          {!hideSearch && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {allowClear && value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer"
              >
                <span>{clearLabel}</span>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {allowCustomValue && trimmedSearch && !hasExactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(trimmedSearch)}
                className="w-full px-3 py-2 text-left text-xs font-medium text-emerald-800 bg-emerald-50/60 hover:bg-emerald-50 border-b border-emerald-100 flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">Usar &ldquo;{trimmedSearch}&rdquo;</span>
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </button>
            )}

            {loading ? (
              <div className="px-3 py-6 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>{loadingText}</span>
              </div>
            ) : error ? (
              <div className="p-3 text-xs text-red-800 bg-red-50/60 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-200 text-red-800 font-medium rounded-md hover:bg-red-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Tentar novamente</span>
                  </button>
                )}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">
                {emptyText}
              </div>
            ) : (
              filteredOptions.slice(0, 250).map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })
            )}
            {filteredOptions.length > 250 && (
              <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 text-center">
                Mostrando os primeiros 250 resultados. Digite para refinar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
