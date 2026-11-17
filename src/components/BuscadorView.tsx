import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Settings,
  Star,
} from 'lucide-react';
import { BRAZIL_STATES, BUSINESS_SEGMENTS, COUNTRIES } from '../data/brazilLocations';
import { logSearchSession, savePlaceToCrm } from '../lib/crmService';
import {
  fetchIbgeCitiesByUf,
  fetchNeighborhoodSuggestions,
  NeighborhoodOption,
} from '../lib/locationService';
import { PlacesApiError, searchPlaces } from '../lib/placesApi';
import { CrmLead, NavigationTab, PlaceSearchResult, SearchFilters } from '../types/lead';
import { SearchableSelect, SelectOptionItem } from './SearchableSelect';
import { WebsiteClassificationIndicator } from './StatusLabels';

interface BuscadorViewProps {
  userId: string;
  savedLeads: CrmLead[];
  apiConfigured: boolean | null;
  onCachePlaces: (places: PlaceSearchResult[]) => void;
  onSessionSearchRecorded: (stats: {
    total: number;
    withoutWebsite: number;
    withWebsite: number;
  }) => void;
  onNavigate: (tab: NavigationTab) => void;
}

const ITEMS_PER_VIEW_PAGE = 10;

const RESULT_COUNT_OPTIONS: SelectOptionItem[] = [
  { value: '10', label: 'Até 10 empresas' },
  { value: '20', label: 'Até 20 empresas' },
  { value: '40', label: 'Até 40 empresas (2 páginas)' },
  { value: '60', label: 'Até 60 empresas (máx. API)' },
];

export function BuscadorView({
  userId,
  savedLeads,
  apiConfigured,
  onCachePlaces,
  onSessionSearchRecorded,
  onNavigate,
}: BuscadorViewProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    country: 'Brasil',
    regionCode: 'BR',
    state: '',
    city: '',
    neighborhood: '',
    segment: 'Clínica Odontológica',
    requestedCount: 20,
    onlyWithoutWebsite: true,
    onlyWithPhone: false,
  });

  // Cidades (IBGE)
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [citiesRetryTick, setCitiesRetryTick] = useState(0);

  // Bairros (Google Places API New via backend)
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<NeighborhoodOption[]>([]);
  const [neighborhoodsLoading, setNeighborhoodsLoading] = useState(false);
  const [neighborhoodsError, setNeighborhoodsError] = useState<string | null>(null);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const [neighborhoodDropdownOpen, setNeighborhoodDropdownOpen] = useState(false);
  const neighborhoodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const neighborhoodRequestIdRef = useRef(0);

  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [lastQueryText, setLastQueryText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const countryOptions = useMemo<SelectOptionItem[]>(
    () => COUNTRIES.map((c) => ({ value: c.name, label: c.name })),
    []
  );

  const stateOptions = useMemo<SelectOptionItem[]>(
    () =>
      BRAZIL_STATES.map((st) => ({
        value: st.uf,
        label: `${st.uf} — ${st.name}`,
      })),
    []
  );

  const cityOptions = useMemo<SelectOptionItem[]>(
    () => cities.map((cityName) => ({ value: cityName, label: cityName })),
    [cities]
  );

  const segmentOptions = useMemo<SelectOptionItem[]>(
    () => BUSINESS_SEGMENTS.map((seg) => ({ value: seg, label: seg })),
    []
  );

  const neighborhoodSelectOptions = useMemo<SelectOptionItem[]>(() => {
    const mapped = neighborhoodOptions.map((n) => ({
      value: n.name,
      label: n.name,
      sublabel: n.subtitle,
    }));
    if (
      filters.neighborhood &&
      !mapped.some((opt) => opt.value.toLowerCase() === filters.neighborhood.toLowerCase())
    ) {
      mapped.unshift({
        value: filters.neighborhood,
        label: filters.neighborhood,
        sublabel: `${filters.city}${filters.state ? ` - ${filters.state}` : ''}`,
      });
    }
    return mapped;
  }, [neighborhoodOptions, filters.neighborhood, filters.city, filters.state]);

  // Carrega municípios da API oficial do IBGE sempre que o estado (UF) mudar
  useEffect(() => {
    if (filters.country !== 'Brasil' || !filters.state) {
      setCities([]);
      setCitiesLoading(false);
      setCitiesError(null);
      return;
    }

    let cancelled = false;
    setCitiesLoading(true);
    setCitiesError(null);

    fetchIbgeCitiesByUf(filters.state)
      .then((loadedCities) => {
        if (!cancelled) {
          setCities(loadedCities);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCities([]);
          setCitiesError(
            err instanceof Error
              ? err.message
              : 'Erro ao carregar municípios do estado selecionado.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters.country, filters.state, citiesRetryTick]);

  const loadNeighborhoods = useCallback(
    async (queryText: string) => {
      if (!filters.city.trim()) {
        setNeighborhoodOptions([]);
        setNeighborhoodsError(null);
        return;
      }

      const requestId = ++neighborhoodRequestIdRef.current;
      setNeighborhoodsLoading(true);
      setNeighborhoodsError(null);

      try {
        const items = await fetchNeighborhoodSuggestions({
          country: filters.country,
          regionCode: filters.regionCode,
          state: filters.state,
          city: filters.city,
          query: queryText,
        });

        if (requestId === neighborhoodRequestIdRef.current) {
          setNeighborhoodOptions(items);
        }
      } catch (err) {
        if (requestId === neighborhoodRequestIdRef.current) {
          setNeighborhoodOptions([]);
          setNeighborhoodsError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar sugestões de bairros.'
          );
        }
      } finally {
        if (requestId === neighborhoodRequestIdRef.current) {
          setNeighborhoodsLoading(false);
        }
      }
    },
    [filters.country, filters.regionCode, filters.state, filters.city]
  );

  // Consulta bairros sob demanda com debounce ao abrir o dropdown ou digitar
  useEffect(() => {
    if (!neighborhoodDropdownOpen || !filters.city.trim()) {
      return;
    }

    if (neighborhoodDebounceRef.current) {
      clearTimeout(neighborhoodDebounceRef.current);
    }

    const delay = neighborhoodQuery.trim() ? 300 : 0;
    neighborhoodDebounceRef.current = setTimeout(() => {
      void loadNeighborhoods(neighborhoodQuery);
    }, delay);

    return () => {
      if (neighborhoodDebounceRef.current) {
        clearTimeout(neighborhoodDebounceRef.current);
      }
    };
  }, [neighborhoodDropdownOpen, neighborhoodQuery, filters.city, loadNeighborhoods]);

  const savedPlaceIds = useMemo(
    () => new Set(savedLeads.map((l) => l.placeId)),
    [savedLeads]
  );

  const filteredResults = useMemo(() => {
    return results.filter((place) => {
      if (filters.onlyWithoutWebsite && place.hasWebsiteUri) return false;
      if (filters.onlyWithPhone && !place.phone) return false;
      return true;
    });
  }, [results, filters.onlyWithoutWebsite, filters.onlyWithPhone]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / ITEMS_PER_VIEW_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedResults = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_VIEW_PAGE;
    return filteredResults.slice(start, start + ITEMS_PER_VIEW_PAGE);
  }, [filteredResults, safeCurrentPage]);

  const rawStats = useMemo(() => {
    const total = results.length;
    const withoutWebsite = results.filter((p) => !p.hasWebsiteUri).length;
    const withWebsite = results.filter((p) => p.hasWebsiteUri).length;
    const withPhone = results.filter((p) => Boolean(p.phone)).length;
    return { total, withoutWebsite, withWebsite, withPhone };
  }, [results]);

  const handleCountryChange = (countryName: string) => {
    const found = COUNTRIES.find((c) => c.name === countryName);
    neighborhoodRequestIdRef.current++;
    setCities([]);
    setCitiesError(null);
    setNeighborhoodOptions([]);
    setNeighborhoodsError(null);
    setNeighborhoodQuery('');
    setFilters((prev) => ({
      ...prev,
      country: countryName,
      regionCode: found?.regionCode || 'BR',
      state: '',
      city: '',
      neighborhood: '',
    }));
  };

  const handleStateChange = (uf: string) => {
    neighborhoodRequestIdRef.current++;
    setNeighborhoodOptions([]);
    setNeighborhoodsError(null);
    setNeighborhoodQuery('');
    setFilters((prev) => ({
      ...prev,
      state: uf,
      city: '',
      neighborhood: '',
    }));
  };

  const handleCityChange = (cityName: string) => {
    neighborhoodRequestIdRef.current++;
    setNeighborhoodOptions([]);
    setNeighborhoodsError(null);
    setNeighborhoodQuery('');
    setFilters((prev) => ({
      ...prev,
      city: cityName,
      neighborhood: '',
    }));
  };

  const runSearch = async () => {
    setError(null);
    setFeedbackMessage(null);

    if (filters.country === 'Brasil' && !filters.state) {
      setError({ message: 'Selecione um estado antes de iniciar a busca.' });
      return;
    }

    if (!filters.city.trim()) {
      setError({ message: 'Selecione uma cidade para delimitar a busca geográfica.' });
      return;
    }

    if (!filters.segment.trim()) {
      setError({ message: 'Informe ou selecione um segmento empresarial para pesquisar.' });
      return;
    }

    setLoading(true);
    setCurrentPage(1);

    try {
      const response = await searchPlaces(filters);
      setResults(response.places);
      setNextPageToken(response.nextPageToken);
      setLastQueryText(response.queryText);
      onCachePlaces(response.places);
      onSessionSearchRecorded({
        total: response.stats.totalReturned,
        withoutWebsite: response.stats.withoutWebsiteCount,
        withWebsite: response.stats.withWebsiteCount,
      });

      try {
        await logSearchSession(userId, {
          queryText: response.queryText,
          country: filters.country,
          state: filters.state,
          city: filters.city,
          neighborhood: filters.neighborhood,
          segment: filters.segment,
          totalFound: response.stats.totalReturned,
          withoutWebsiteCount: response.stats.withoutWebsiteCount,
          withWebsiteCount: response.stats.withWebsiteCount,
          withPhoneCount: response.stats.withPhoneCount,
        });
      } catch (logErr) {
        console.warn('Falha ao registrar log da pesquisa:', logErr);
      }
    } catch (err) {
      if (err instanceof PlacesApiError) {
        setError({ message: err.message, code: err.errorCode });
      } else {
        setError({
          message: err instanceof Error ? err.message : 'Erro ao executar busca de empresas.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch();
  };

  const handleLoadMoreFromApi = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const response = await searchPlaces({ ...filters, requestedCount: 20 }, nextPageToken);
      const existingIds = new Set(results.map((r) => r.placeId));
      const newOnes = response.places.filter((p) => !existingIds.has(p.placeId));

      setResults((prev) => [...prev, ...newOnes]);
      setNextPageToken(response.nextPageToken);
      onCachePlaces(newOnes);
      onSessionSearchRecorded({
        total: newOnes.length,
        withoutWebsite: newOnes.filter((p) => !p.hasWebsiteUri).length,
        withWebsite: newOnes.filter((p) => p.hasWebsiteUri).length,
      });
    } catch (err) {
      if (err instanceof PlacesApiError) {
        setError({ message: err.message, code: err.errorCode });
      } else {
        setError({ message: 'Não foi possível carregar mais resultados.' });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSaveSingleLead = async (place: PlaceSearchResult) => {
    setSavingPlaceId(place.placeId);
    setFeedbackMessage(null);
    setError(null);
    try {
      await savePlaceToCrm(userId, place, {
        segment: filters.segment || place.category,
        city: filters.city,
        state: filters.state,
        neighborhood: filters.neighborhood,
      });
      onCachePlaces([place]);
      setFeedbackMessage(`"${place.name}" salvo no CRM com sucesso.`);
    } catch (err) {
      setError({
        message:
          err instanceof Error
            ? `Erro ao salvar lead no CRM: ${err.message}`
            : 'Erro ao salvar lead no CRM.',
      });
    } finally {
      setSavingPlaceId(null);
    }
  };

  const handleBatchSaveWithoutWebsite = async () => {
    const candidates = filteredResults.filter(
      (p) => !p.hasWebsiteUri && !savedPlaceIds.has(p.placeId)
    );
    if (candidates.length === 0) return;
    setBatchSaving(true);
    setFeedbackMessage(null);
    setError(null);

    try {
      let savedCount = 0;
      for (const place of candidates.slice(0, 20)) {
        await savePlaceToCrm(userId, place, {
          segment: filters.segment || place.category,
          city: filters.city,
          state: filters.state,
          neighborhood: filters.neighborhood,
        });
        savedCount++;
      }
      onCachePlaces(candidates);
      setFeedbackMessage(
        `${savedCount} ${savedCount === 1 ? 'empresa salva' : 'empresas salvas'} no CRM para prospecção.`
      );
    } catch (err) {
      setError({
        message:
          err instanceof Error
            ? `Erro ao salvar lote no CRM: ${err.message}`
            : 'Erro ao salvar empresas no CRM.',
      });
    } finally {
      setBatchSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Aviso caso API ainda não configurada */}
      {apiConfigured === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Chave da Google Places API (New) ainda não detectada no servidor
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Configure a variável de ambiente no servidor para habilitar buscas em tempo real no Google Maps.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('configuracoes')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-900 text-white text-xs font-semibold rounded-lg hover:bg-amber-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Ir para Configurações</span>
          </button>
        </div>
      )}

      {/* Formulário de Filtros */}
      <form
        onSubmit={executeSearch}
        className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Buscador de empresas no Google Maps
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta ao vivo via Google Places API (New) Text Search para localizar oportunidades comerciais.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* País */}
          <SearchableSelect
            id="filter-country"
            label="País"
            value={filters.country}
            options={countryOptions}
            onChange={handleCountryChange}
            placeholder="Selecione o país"
            searchPlaceholder="Pesquisar país..."
            emptyText="Nenhum país encontrado."
            required
          />

          {/* Estado */}
          {filters.country === 'Brasil' ? (
            <SearchableSelect
              id="filter-state"
              label="Estado"
              value={filters.state}
              options={stateOptions}
              onChange={handleStateChange}
              placeholder="Selecione o estado"
              searchPlaceholder="Pesquisar estado ou sigla..."
              emptyText="Nenhum estado encontrado."
              required
            />
          ) : (
            <div>
              <label htmlFor="filter-state" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estado / Região
              </label>
              <input
                id="filter-state"
                type="text"
                value={filters.state}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    state: e.target.value,
                    city: '',
                    neighborhood: '',
                  }))
                }
                placeholder="Ex.: Lisboa, FL"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Cidade */}
          {filters.country === 'Brasil' ? (
            <SearchableSelect
              id="filter-city"
              label="Cidade"
              value={filters.city}
              options={cityOptions}
              onChange={handleCityChange}
              placeholder="Selecione a cidade"
              searchPlaceholder="Digite o nome da cidade..."
              disabled={!filters.state}
              disabledPlaceholder="Selecione um estado primeiro"
              loading={citiesLoading}
              loadingText="Carregando municípios no IBGE..."
              error={citiesError}
              onRetry={() => setCitiesRetryTick((t) => t + 1)}
              emptyText="Nenhuma cidade encontrada neste estado."
              required
            />
          ) : (
            <div>
              <label htmlFor="filter-city" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cidade <span className="text-blue-600">*</span>
              </label>
              <input
                id="filter-city"
                type="text"
                value={filters.city}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="Digite o nome da cidade"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Bairro (Google Places Autocomplete delimitado à cidade) */}
          <SearchableSelect
            id="filter-neighborhood"
            label="Bairro (opcional)"
            value={filters.neighborhood}
            options={neighborhoodSelectOptions}
            onChange={(val) => setFilters((p) => ({ ...p, neighborhood: val }))}
            placeholder="Cidade inteira (ou selecione)"
            searchPlaceholder="Digite o nome do bairro..."
            disabled={!filters.city.trim()}
            disabledPlaceholder="Selecione uma cidade primeiro"
            loading={neighborhoodsLoading}
            loadingText="Buscando bairros no Google Places..."
            error={neighborhoodsError}
            onRetry={() => void loadNeighborhoods(neighborhoodQuery)}
            emptyText={
              neighborhoodQuery.trim()
                ? `Nenhum bairro encontrado em ${filters.city} para "${neighborhoodQuery.trim()}".`
                : `Digite o nome do bairro em ${filters.city} para filtrar.`
            }
            allowClear
            clearLabel="Pesquisar na cidade inteira"
            filterLocally={false}
            onSearchQueryChange={(q) => setNeighborhoodQuery(q)}
            onOpenChange={(open) => {
              setNeighborhoodDropdownOpen(open);
              if (!open) {
                setNeighborhoodQuery('');
              }
            }}
          />

          {/* Segmento Empresarial */}
          <SearchableSelect
            id="filter-segment"
            label="Segmento empresarial"
            value={filters.segment}
            options={segmentOptions}
            onChange={(val) => setFilters((p) => ({ ...p, segment: val }))}
            placeholder="Selecione ou digite o segmento"
            searchPlaceholder="Pesquisar ou digitar segmento..."
            emptyText="Digite para usar um segmento personalizado."
            allowCustomValue
            required
          />

          {/* Quantidade de resultados */}
          <SearchableSelect
            id="filter-count"
            label="Quantidade de resultados"
            value={String(filters.requestedCount)}
            options={RESULT_COUNT_OPTIONS}
            onChange={(val) =>
              setFilters((p) => ({
                ...p,
                requestedCount: Number(val) as 10 | 20 | 40 | 60,
              }))
            }
            placeholder="Selecione a quantidade"
            hideSearch
          />
        </div>

        {/* Filtros booleanos + Botão Pesquisar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.onlyWithoutWebsite}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, onlyWithoutWebsite: e.target.checked }));
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Somente sem site informado no Google</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.onlyWithPhone}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, onlyWithPhone: e.target.checked }));
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Somente com telefone</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pesquisando no Google...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Buscar empresas</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Mensagens de erro ou feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                Não foi possível concluir a pesquisa
              </p>
              <p className="text-xs text-red-800 mt-0.5">{error.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-300 text-red-900 text-xs font-semibold rounded-lg hover:bg-red-100 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
            {error.code === 'API_KEY_MISSING' || error.code === 'API_KEY_INVALID_OR_RESTRICTED' ? (
              <button
                type="button"
                onClick={() => onNavigate('configuracoes')}
                className="px-3.5 py-2 bg-red-800 text-white text-xs font-semibold rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer"
              >
                Verificar Configurações
              </button>
            ) : null}
          </div>
        </div>
      )}

      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-4">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => onNavigate('crm')}
            className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap cursor-pointer"
          >
            Ver no CRM
          </button>
        </div>
      )}

      {/* Nota metodológica de classificação */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Empresas sem o campo <code className="font-mono text-slate-800">websiteUri</code> preenchido no Google Places são classificadas como <strong className="text-slate-800">SEM SITE INFORMADO NO GOOGLE</strong>. Isso indica ausência de site cadastrado no perfil comercial do Google, sendo recomendada verificação adicional antes de afirmar que o negócio não possui website próprio.
        </p>
      </div>

      {/* Resumo e Resultados */}
      {results.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Toolbar dos resultados */}
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Busca: “{lastQueryText}”
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {rawStats.total} retornadas
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">
                {rawStats.withoutWebsite} sem site informado
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {rawStats.withPhone} com telefone
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-800">
                Exibindo {filteredResults.length} após filtros
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {filteredResults.some((p) => !p.hasWebsiteUri && !savedPlaceIds.has(p.placeId)) && (
                <button
                  type="button"
                  onClick={handleBatchSaveWithoutWebsite}
                  disabled={batchSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {batchSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Salvar sem site no CRM</span>
                </button>
              )}
            </div>
          </div>

          {filteredResults.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-800">
                Nenhuma empresa corresponde aos filtros selecionados nesta página.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Desmarque “Somente sem site informado no Google” ou “Somente com telefone” para visualizar todas as {rawStats.total} empresas encontradas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Empresa & Categoria</th>
                    <th className="py-3 px-4">Endereço</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Avaliação</th>
                    <th className="py-3 px-4">Presença Digital</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedResults.map((place) => {
                    const isSaved = savedPlaceIds.has(place.placeId);
                    const isSaving = savingPlaceId === place.placeId;
                    return (
                      <tr key={place.placeId} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {place.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {place.category}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1 truncate max-w-[220px]" title={place.placeId}>
                            ID: {place.placeId}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{place.address || 'Endereço não informado'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {place.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-800">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {place.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Não informado</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {place.rating !== null ? (
                            <div className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-800">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                              <span className="font-semibold">{place.rating.toFixed(1)}</span>
                              <span className="text-slate-400">({place.userRatingCount})</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Sem avaliações</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            <WebsiteClassificationIndicator
                              classification={place.websiteClassification}
                            />
                            {place.websiteUri && (
                              <div>
                                <a
                                  href={place.websiteUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline max-w-[210px] truncate"
                                >
                                  <span className="truncate">{place.websiteUri}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <a
                              href={place.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                              title="Abrir no Google Maps"
                            >
                              <span>Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            {isSaved ? (
                              <button
                                type="button"
                                onClick={() => onNavigate('crm')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                <BookmarkCheck className="w-3.5 h-3.5" />
                                <span>No CRM</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleLead(place)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0A192F] hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Salvar no CRM</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação + Carregar mais via nextPageToken */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
              <span>
                Página {safeCurrentPage} de {totalPages}
              </span>
              <span>·</span>
              <span>{filteredResults.length} registros filtrados</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {nextPageToken && (
                <button
                  type="button"
                  onClick={handleLoadMoreFromApi}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Buscar próxima página na API</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 md:p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 mx-auto mb-4">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Pronto para prospectar empresas reais
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
              Defina o estado, cidade, bairro e segmento acima e clique em <strong>Buscar empresas</strong>. Todos os resultados exibidos vêm diretamente da Google Places API (New), sem dados simulados.
            </p>
          </div>
        )
      )}
    </div>
  );
}
