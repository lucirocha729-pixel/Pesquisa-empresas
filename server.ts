import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPortIndex = process.argv.indexOf('--port');
const cliPort = cliPortIndex !== -1 ? Number(process.argv[cliPortIndex + 1]) : NaN;
const PORT =
  Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : process.env.NODE_ENV === 'production'
      ? Number(process.env.PORT || 3000)
      : Number(process.env.DEFAULT_APP_PORT || 3000);

const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_BASE_URL = 'https://places.googleapis.com/v1/places';
const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

const AUTOCOMPLETE_FIELD_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text.text',
  'suggestions.placePrediction.structuredFormat.mainText.text',
  'suggestions.placePrediction.structuredFormat.secondaryText.text',
  'suggestions.placePrediction.types',
].join(',');

const TEXT_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

const PLACE_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'primaryTypeDisplayName',
  'formattedAddress',
  'shortFormattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'rating',
  'userRatingCount',
  'businessStatus',
].join(',');

interface SearchPlaceItem {
  placeId: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  websiteUri: string;
  hasWebsiteUri: boolean;
  websiteClassification: 'SEM_SITE_INFORMADO_GOOGLE' | 'SITE_INFORMADO_GOOGLE';
  googleMapsUri: string;
  rating: number | null;
  userRatingCount: number;
  businessStatus: string;
}

interface RawGooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  formattedAddress?: string;
  shortFormattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

interface RateBucket {
  timestamps: number[];
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimiterStore = new globalThis.Map<string, RateBucket>();

// Cache em memória temporário de sessão (TTL curto, nunca persistido em banco)
const HYDRATE_CACHE_TTL_MS = 10 * 60 * 1000;
const hydrateMemoryCache = new globalThis.Map<string, { expiresAt: number; data: SearchPlaceItem }>();

interface CityGeoBounds {
  center?: { latitude: number; longitude: number };
  viewport?: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
}

const cityBoundsCache = new globalThis.Map<string, { expiresAt: number; bounds: CityGeoBounds }>();

function normalizeComparisonText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function resolveCityGeoBounds(
  key: string,
  city: string,
  state: string,
  country: string,
  regionCode: string
): Promise<CityGeoBounds> {
  const cacheKey = `${normalizeComparisonText(city)}|${normalizeComparisonText(state)}|${normalizeComparisonText(country)}`;
  const cached = cityBoundsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bounds;
  }

  const locationQuery = [city, state, country].filter(Boolean).join(', ');
  try {
    const response = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.location,places.viewport',
        'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
      },
      body: JSON.stringify({
        textQuery: locationQuery,
        pageSize: 1,
        languageCode: 'pt-BR',
        regionCode,
      }),
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as {
      places?: Array<{
        location?: { latitude: number; longitude: number };
        viewport?: {
          low: { latitude: number; longitude: number };
          high: { latitude: number; longitude: number };
        };
      }>;
    };

    const first = data.places?.[0];
    const bounds: CityGeoBounds = {
      center: first?.location,
      viewport: first?.viewport,
    };

    cityBoundsCache.set(cacheKey, {
      expiresAt: Date.now() + HYDRATE_CACHE_TTL_MS,
      bounds,
    });

    return bounds;
  } catch {
    return {};
  }
}

function getServerPlacesApiKey(): { key: string | null; source: string | null } {
  if (process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACES_API_KEY.trim()) {
    return { key: process.env.GOOGLE_PLACES_API_KEY.trim(), source: 'GOOGLE_PLACES_API_KEY' };
  }
  if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim()) {
    return { key: process.env.GOOGLE_MAPS_API_KEY.trim(), source: 'GOOGLE_MAPS_API_KEY' };
  }
  if (process.env.VITE_GOOGLE_MAPS_API_KEY && process.env.VITE_GOOGLE_MAPS_API_KEY.trim()) {
    return { key: process.env.VITE_GOOGLE_MAPS_API_KEY.trim(), source: 'VITE_GOOGLE_MAPS_API_KEY' };
  }
  return { key: null, source: null };
}

function getMaskedHint(key: string | null): string | null {
  if (!key || key.length < 8) return null;
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

function checkRateLimit(clientKey: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimiterStore.get(clientKey) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    rateLimiterStore.set(clientKey, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  rateLimiterStore.set(clientKey, bucket);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

function normalizeGooglePlace(raw: RawGooglePlace, fallbackCategory: string): SearchPlaceItem | null {
  if (!raw.id) return null;
  const websiteUri = (raw.websiteUri || '').trim();
  const hasWebsiteUri = websiteUri.length > 0;
  const phone = (raw.nationalPhoneNumber || raw.internationalPhoneNumber || '').trim();

  return {
    placeId: raw.id,
    name: (raw.displayName?.text || 'Empresa sem nome informado').trim(),
    category: (raw.primaryTypeDisplayName?.text || raw.types?.[0] || fallbackCategory || 'Empresa').trim(),
    address: (raw.formattedAddress || raw.shortFormattedAddress || '').trim(),
    phone,
    websiteUri,
    hasWebsiteUri,
    websiteClassification: hasWebsiteUri ? 'SITE_INFORMADO_GOOGLE' : 'SEM_SITE_INFORMADO_GOOGLE',
    googleMapsUri: (raw.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(raw.id)}`).trim(),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : 0,
    businessStatus: raw.businessStatus || 'OPERATIONAL',
  };
}

function parseGoogleApiError(status: number, bodyText: string): {
  httpStatus: number;
  errorCode: string;
  message: string;
} {
  let parsedStatus = '';
  let parsedMessage = '';
  try {
    const json = JSON.parse(bodyText);
    parsedStatus = json?.error?.status || '';
    parsedMessage = json?.error?.message || '';
  } catch {
    parsedMessage = bodyText;
  }

  if (status === 429 || parsedStatus === 'RESOURCE_EXHAUSTED') {
    return {
      httpStatus: 429,
      errorCode: 'QUOTA_EXCEEDED',
      message: 'Limite de requisições da API do Google Places atingido no momento. Aguarde antes de realizar novas buscas.',
    };
  }
  if (status === 401 || status === 403 || parsedStatus === 'PERMISSION_DENIED') {
    return {
      httpStatus: 403,
      errorCode: 'API_KEY_INVALID_OR_RESTRICTED',
      message: 'Chave da API do Google Places inválida, sem permissão ou com a Places API (New) desativada no projeto.',
    };
  }
  if (status === 400 || parsedStatus === 'INVALID_ARGUMENT') {
    return {
      httpStatus: 400,
      errorCode: 'INVALID_ARGUMENT',
      message: parsedMessage || 'Parâmetros de busca inválidos enviados à Google Places API.',
    };
  }
  return {
    httpStatus: status >= 400 ? status : 500,
    errorCode: 'PLACES_API_ERROR',
    message: parsedMessage || 'Erro ao consultar a Google Places API (New).',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'vira-app-pesquisa-de-empresas' });
  });

  // Status seguro da configuração (nunca expõe a chave)
  app.get('/api/config/status', (_req, res) => {
    const { key, source } = getServerPlacesApiKey();
    res.json({
      placesApiConfigured: Boolean(key),
      keySource: source,
      keyHint: getMaskedHint(key),
      endpoint: PLACES_SEARCH_TEXT_URL,
      attributionId: GMP_ATTRIBUTION_ID,
      rateLimitPerMinute: RATE_LIMIT_MAX_REQUESTS,
      cachePolicy: 'Apenas placeId e dados próprios do CRM são persistidos no Firestore em conformidade com os Termos do Google Maps Platform.',
    });
  });

  // Teste seguro de conectividade com a Google Places API (New)
  app.post('/api/places/test', async (req, res) => {
    const { key } = getServerPlacesApiKey();
    if (!key) {
      res.status(400).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        message: 'Chave da Google Places API não encontrada nas variáveis de ambiente do servidor.',
      });
      return;
    }

    const clientIp = req.ip || 'local';
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      res.status(429).json({
        ok: false,
        errorCode: 'RATE_LIMITED',
        message: `Muitas requisições seguidas. Tente novamente em ${rate.retryAfterSeconds}s.`,
      });
      return;
    }

    try {
      const response = await fetch(PLACES_SEARCH_TEXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id',
          'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
        },
        body: JSON.stringify({
          textQuery: 'Padaria em São Paulo, Brasil',
          pageSize: 1,
          languageCode: 'pt-BR',
          regionCode: 'BR',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        const err = parseGoogleApiError(response.status, text);
        res.status(err.httpStatus).json({ ok: false, errorCode: err.errorCode, message: err.message });
        return;
      }

      const data = await response.json();
      res.json({
        ok: true,
        message: 'Conexão validada com sucesso na Google Places API (New).',
        sampleCount: Array.isArray(data.places) ? data.places.length : 0,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Falha de rede ao conectar à Google Places API.',
      });
    }
  });

  // Sugestão de bairros via Google Places API (New) - Autocomplete delimitado à cidade/estado
  app.post('/api/places/neighborhoods', async (req, res) => {
    const { key } = getServerPlacesApiKey();
    if (!key) {
      res.status(503).json({
        errorCode: 'API_KEY_MISSING',
        message: 'A chave da Google Places API (New) não está configurada no servidor.',
      });
      return;
    }

    const clientIp = req.ip || 'local';
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      res.status(429).json({
        errorCode: 'RATE_LIMITED',
        message: `Limite de requisições atingido (${rate.retryAfterSeconds}s). Aguarde um instante.`,
      });
      return;
    }

    const {
      country = 'Brasil',
      regionCode = 'BR',
      state = '',
      city = '',
      query = '',
    } = req.body || {};

    const cleanCity = String(city || '').trim();
    const cleanState = String(state || '').trim();
    const cleanCountry = String(country || 'Brasil').trim();
    const cleanQuery = String(query || '').trim();
    const cleanRegion = String(regionCode || 'BR').trim().toUpperCase().slice(0, 2);

    if (!cleanCity) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Selecione uma cidade antes de consultar os bairros.',
      });
      return;
    }

    try {
      const cityBounds = await resolveCityGeoBounds(
        key,
        cleanCity,
        cleanState,
        cleanCountry,
        cleanRegion
      );

      // Com locationRestriction/locationBias da cidade já definido, enviamos apenas o termo digitado
      // para que prefixos parciais (ex: "Camb", "Copa") encontrem os bairros daquela cidade.
      const hasGeoScope = Boolean(cityBounds.viewport || cityBounds.center);
      const inputQuery = cleanQuery
        ? hasGeoScope
          ? cleanQuery
          : `${cleanQuery}, ${cleanCity}`
        : `Jardim, ${cleanCity}`;

      const payload: Record<string, unknown> = {
        input: inputQuery,
        includedPrimaryTypes: ['(regions)'],
        includedRegionCodes: [cleanRegion.toLowerCase()],
        languageCode: 'pt-BR',
        regionCode: cleanRegion.toLowerCase(),
      };

      if (cityBounds.viewport) {
        payload.locationRestriction = { rectangle: cityBounds.viewport };
      } else if (cityBounds.center) {
        payload.locationBias = {
          circle: {
            center: cityBounds.center,
            radius: 30000.0,
          },
        };
      }

      const apiResponse = await fetch(PLACES_AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': AUTOCOMPLETE_FIELD_MASK,
          'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
        },
        body: JSON.stringify(payload),
      });

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        const parsedErr = parseGoogleApiError(apiResponse.status, errText);
        res.status(parsedErr.httpStatus).json({
          errorCode: parsedErr.errorCode,
          message: parsedErr.message,
        });
        return;
      }

      const json = (await apiResponse.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
            types?: string[];
          };
        }>;
      };

      const normalizedCity = normalizeComparisonText(cleanCity);
      const seenNames = new Set<string>();
      const neighborhoods: Array<{ name: string; subtitle: string; placeId: string }> = [];

      for (const item of json.suggestions || []) {
        const pred = item.placePrediction;
        if (!pred?.placeId) continue;

        const types = pred.types || [];
        const isNeighborhoodType = types.some(
          (t) => t === 'neighborhood' || t.startsWith('sublocality')
        );
        // Ignora CEPs, estados ou cidades inteiras que não sejam sublocalidades/bairros
        if (!isNeighborhoodType) {
          continue;
        }

        const mainText = (pred.structuredFormat?.mainText?.text || pred.text?.text || '').trim();
        const secondaryText = (pred.structuredFormat?.secondaryText?.text || '').trim();
        const fullText = (pred.text?.text || '').trim();

        if (!mainText) continue;

        // Garante estritamente que o bairro pertence à cidade selecionada
        const normalizedContext = normalizeComparisonText(`${secondaryText} ${fullText}`);
        if (!normalizedContext.includes(normalizedCity)) {
          continue;
        }

        const normalizedMain = normalizeComparisonText(mainText);
        if (!seenNames.has(normalizedMain)) {
          seenNames.add(normalizedMain);
          neighborhoods.push({
            name: mainText,
            subtitle: secondaryText || `${cleanCity}${cleanState ? ` - ${cleanState}` : ''}`,
            placeId: pred.placeId,
          });
        }
      }

      res.json({ neighborhoods });
    } catch (error) {
      res.status(502).json({
        errorCode: 'NETWORK_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Erro de comunicação ao buscar bairros na Google Places API (New).',
      });
    }
  });

  // Busca de empresas via Google Places API (New) - Text Search
  app.post('/api/places/search', async (req, res) => {
    const { key } = getServerPlacesApiKey();
    if (!key) {
      res.status(503).json({
        errorCode: 'API_KEY_MISSING',
        message: 'A chave da Google Places API (New) não está configurada no servidor. Verifique o painel de Configurações.',
      });
      return;
    }

    const clientIp = req.ip || 'local';
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      res.status(429).json({
        errorCode: 'RATE_LIMITED',
        message: `Limite de segurança de ${RATE_LIMIT_MAX_REQUESTS} requisições/minuto atingido. Aguarde ${rate.retryAfterSeconds}s.`,
      });
      return;
    }

    const {
      country = 'Brasil',
      regionCode = 'BR',
      state = '',
      city = '',
      neighborhood = '',
      segment = '',
      requestedCount = 20,
      pageToken = '',
    } = req.body || {};

    const cleanSegment = String(segment || '').trim();
    const cleanCity = String(city || '').trim();
    const cleanState = String(state || '').trim();
    const cleanNeighborhood = String(neighborhood || '').trim();
    const cleanCountry = String(country || 'Brasil').trim();

    if (!cleanSegment) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Informe um segmento empresarial para iniciar a pesquisa.',
      });
      return;
    }

    if (!cleanCity && !cleanState) {
      res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Informe ao menos uma cidade ou estado para delimitar a busca geográfica.',
      });
      return;
    }

    const locationParts = [cleanNeighborhood, cleanCity, cleanState, cleanCountry].filter(Boolean);
    const textQuery = `${cleanSegment} em ${locationParts.join(', ')}`;

    // Places Text Search (New) aceita pageSize de 1 a 20 por página (máximo 60 no total em até 3 páginas)
    const targetTotal = Math.min(60, Math.max(1, Number(requestedCount) || 20));
    const maxPagesToFetch = pageToken ? 1 : Math.min(3, Math.ceil(targetTotal / 20));
    const constantPageSize = maxPagesToFetch > 1 ? 20 : Math.min(20, targetTotal);

    const collectedPlaces: SearchPlaceItem[] = [];
    let currentToken: string | undefined = typeof pageToken === 'string' && pageToken.trim() ? pageToken.trim() : undefined;
    let finalNextPageToken: string | null = null;

    try {
      for (let pageIndex = 0; pageIndex < maxPagesToFetch; pageIndex++) {
        const payload: Record<string, unknown> = {
          textQuery,
          pageSize: constantPageSize,
          languageCode: 'pt-BR',
          regionCode: String(regionCode || 'BR').toUpperCase().slice(0, 2),
        };

        if (currentToken) {
          payload.pageToken = currentToken;
        }

        const apiResponse = await fetch(PLACES_SEARCH_TEXT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
            'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
          },
          body: JSON.stringify(payload),
        });

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          const parsedErr = parseGoogleApiError(apiResponse.status, errText);
          res.status(parsedErr.httpStatus).json({
            errorCode: parsedErr.errorCode,
            message: parsedErr.message,
          });
          return;
        }

        const json = (await apiResponse.json()) as {
          places?: RawGooglePlace[];
          nextPageToken?: string;
        };

        const normalizedBatch = (json.places || [])
          .map((item) => normalizeGooglePlace(item, cleanSegment))
          .filter((item): item is SearchPlaceItem => item !== null);

        for (const place of normalizedBatch) {
          if (!collectedPlaces.some((existing) => existing.placeId === place.placeId)) {
            collectedPlaces.push(place);
            hydrateMemoryCache.set(place.placeId, {
              expiresAt: Date.now() + HYDRATE_CACHE_TTL_MS,
              data: place,
            });
          }
        }

        finalNextPageToken = json.nextPageToken || null;
        if (!finalNextPageToken || collectedPlaces.length >= targetTotal) {
          break;
        }

        currentToken = finalNextPageToken;
      }

      const withoutWebsiteCount = collectedPlaces.filter((p) => !p.hasWebsiteUri).length;
      const withWebsiteCount = collectedPlaces.filter((p) => p.hasWebsiteUri).length;
      const withPhoneCount = collectedPlaces.filter((p) => Boolean(p.phone)).length;

      res.json({
        queryText: textQuery,
        places: collectedPlaces,
        nextPageToken: finalNextPageToken,
        stats: {
          totalReturned: collectedPlaces.length,
          withoutWebsiteCount,
          withWebsiteCount,
          withPhoneCount,
        },
        rateLimitRemaining: rate.remaining,
      });
    } catch (error) {
      res.status(502).json({
        errorCode: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Erro de comunicação com a Google Places API (New).',
      });
    }
  });

  // Hidratação sob demanda via Place ID (evita armazenar dados de diretório do Google no Firestore)
  app.post('/api/places/hydrate', async (req, res) => {
    const { key } = getServerPlacesApiKey();
    const placeIdsRaw: unknown = req.body?.placeIds;

    if (!Array.isArray(placeIdsRaw) || placeIdsRaw.length === 0) {
      res.json({ items: {} });
      return;
    }

    const uniqueIds = Array.from(
      new Set(
        placeIdsRaw
          .map((id) => String(id || '').trim())
          .filter((id) => /^[a-zA-Z0-9_-]{5,128}$/.test(id))
      )
    ).slice(0, 15);

    const resultMap: Record<string, SearchPlaceItem> = {};
    const idsToFetch: string[] = [];
    const now = Date.now();

    for (const id of uniqueIds) {
      const cached = hydrateMemoryCache.get(id);
      if (cached && cached.expiresAt > now) {
        resultMap[id] = cached.data;
      } else {
        idsToFetch.push(id);
      }
    }

    if (!key || idsToFetch.length === 0) {
      res.json({ items: resultMap, apiConfigured: Boolean(key) });
      return;
    }

    const clientIp = req.ip || 'local';
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      res.status(429).json({
        errorCode: 'RATE_LIMITED',
        message: `Limite de requisições atingido ao atualizar detalhes dos leads (${rate.retryAfterSeconds}s).`,
        items: resultMap,
      });
      return;
    }

    try {
      await Promise.all(
        idsToFetch.map(async (placeId) => {
          const detailUrl = `${PLACES_DETAILS_BASE_URL}/${encodeURIComponent(placeId)}?languageCode=pt-BR`;
          const resp = await fetch(detailUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': key,
              'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
              'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
            },
          });

          if (resp.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          }
          if (!resp.ok) {
            return;
          }
          const raw = (await resp.json()) as RawGooglePlace;
          const normalized = normalizeGooglePlace(raw, 'Empresa');
          if (normalized) {
            resultMap[placeId] = normalized;
            hydrateMemoryCache.set(placeId, {
              expiresAt: Date.now() + HYDRATE_CACHE_TTL_MS,
              data: normalized,
            });
          }
        })
      );

      res.json({ items: resultMap, apiConfigured: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'QUOTA_EXCEEDED') {
        res.status(429).json({
          errorCode: 'QUOTA_EXCEEDED',
          message: 'Cota da Google Places API atingida durante a atualização de detalhes.',
          items: resultMap,
        });
        return;
      }
      res.json({ items: resultMap, apiConfigured: true });
    }
  });

  // Vite middleware em desenvolvimento ou arquivos estáticos em produção
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIRA APP – Pesquisa de Empresas server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
