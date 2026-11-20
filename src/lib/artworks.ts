import type { ArtCard, ArtSearchResult } from '../types'

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
/** Pochi oggetti: ogni risultato richiede 1 HTTP extra (API Met senza thumb in search). */
const SEARCH_DETAIL_LIMIT = 6

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}

export function commonsFileUrl(fileTitleOrPath: string, width = 843): string {
  const name = fileTitleOrPath
    .replace(/^File:/i, '')
    .replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//i, '')
    .replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/File:/i, '')
  const cleaned = decodeURIComponent(name).split('?')[0]
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleaned)}?width=${width}`
}

export function toImageThumb(url: string): string {
  if (!url || url.startsWith('data:')) return url
  if (url.includes('Special:FilePath/')) {
    if (/[?&]width=/i.test(url)) return url.replace(/([?&])width=\d+/i, '$1width=200')
    return `${url}${url.includes('?') ? '&' : '?'}width=200`
  }
  return url
}

export function normalizeImageUrl(url: string): string {
  if (!url || url.startsWith('data:')) return url
  if (url.includes('Special:FilePath/')) {
    if (/[?&]width=/i.test(url)) return url.replace(/([?&])width=\d+/i, '$1width=843')
    return `${url}${url.includes('?') ? '&' : '?'}width=843`
  }
  return url
}

export function shortenText(text: string, maxLen = 260): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.length <= maxLen) return cleaned
  const slice = cleaned.slice(0, maxLen)
  const space = slice.lastIndexOf(' ')
  return (space > 40 ? slice.slice(0, space) : slice).trim() + '…'
}

const PLACE_TO_ISO: Record<string, string> = {
  italy: 'IT',
  italian: 'IT',
  florence: 'IT',
  venice: 'IT',
  rome: 'IT',
  france: 'FR',
  french: 'FR',
  paris: 'FR',
  spain: 'ES',
  spanish: 'ES',
  germany: 'DE',
  german: 'DE',
  netherlands: 'NL',
  dutch: 'NL',
  holland: 'NL',
  belgium: 'BE',
  flemish: 'BE',
  england: 'GB',
  britain: 'GB',
  'united kingdom': 'GB',
  british: 'GB',
  'united states': 'US',
  america: 'US',
  american: 'US',
  japan: 'JP',
  japanese: 'JP',
  china: 'CN',
  chinese: 'CN',
  russia: 'RU',
  russian: 'RU',
  austria: 'AT',
  switzerland: 'CH',
  mexico: 'MX',
  greece: 'GR',
  egypt: 'EG',
  india: 'IN',
  iran: 'IR',
  turkey: 'TR',
}

export function placeToCountries(...places: (string | null | undefined)[]): string[] {
  const codes = new Set<string>()
  for (const place of places) {
    if (!place?.trim()) continue
    const lower = place.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
    for (const [key, iso] of Object.entries(PLACE_TO_ISO)) {
      if (lower.includes(key)) codes.add(iso)
    }
  }
  return [...codes]
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v?.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function encodeSourceId(provider: 'met' | 'wd', id: string | number): string {
  return `${provider}:${id}`
}

function parseSourceId(sourceId: number | string): { provider: 'met' | 'wd'; id: string } {
  const s = String(sourceId)
  if (s.startsWith('met:')) return { provider: 'met', id: s.slice(4) }
  if (s.startsWith('wd:')) return { provider: 'wd', id: s.slice(3) }
  return { provider: 'met', id: s }
}

type MetObject = {
  objectID: number
  title?: string
  artistDisplayName?: string
  objectDate?: string
  medium?: string
  dimensions?: string
  department?: string
  culture?: string
  country?: string
  classification?: string
  objectName?: string
  creditLine?: string
  repository?: string
  primaryImage?: string
  primaryImageSmall?: string
  additionalImages?: string[]
  tags?: { term?: string }[] | null
}

async function metSearchIds(
  query: string,
  artistOrCulture: boolean,
  signal?: AbortSignal,
): Promise<number[]> {
  const url = new URL(`${MET_BASE}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('hasImages', 'true')
  if (artistOrCulture) url.searchParams.set('artistOrCulture', 'true')
  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`Met Museum ${res.status}`)
  const data = (await res.json()) as { objectIDs?: number[] | null }
  return data.objectIDs ?? []
}

async function metGetObject(id: number | string, signal?: AbortSignal): Promise<MetObject | null> {
  const res = await fetch(`${MET_BASE}/objects/${id}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Met Museum oggetto ${id}: ${res.status}`)
  return (await res.json()) as MetObject
}

function metToSearchResult(obj: MetObject): ArtSearchResult | null {
  const image = obj.primaryImageSmall || obj.primaryImage || ''
  if (!image) return null
  return {
    id: encodeSourceId('met', obj.objectID),
    title: obj.title?.trim() || 'Senza titolo',
    artist: obj.artistDisplayName?.trim() || '',
    dateDisplay: obj.objectDate?.trim() || '',
    imageUrl: image,
  }
}

function metToCard(obj: MetObject): {
  card: Omit<ArtCard, 'id' | 'createdAt'>
  imageOptions: string[]
} {
  const ordered = uniqueStrings([
    obj.primaryImage,
    ...(obj.additionalImages ?? []),
    obj.primaryImageSmall,
  ]).filter((u) => u.startsWith('http'))

  const classifications = uniqueStrings([obj.classification, obj.objectName])
  const museum = obj.repository?.trim() || 'The Metropolitan Museum of Art'
  const dept = obj.department?.trim() || ''
  const tags = (obj.tags ?? []).map((t) => t.term).filter(Boolean) as string[]
  const description = shortenText(
    [obj.creditLine, tags.length ? tags.join(', ') : ''].filter(Boolean).join(' — '),
  )

  const card: Omit<ArtCard, 'id' | 'createdAt'> = {
    number: 0,
    sourceId: encodeSourceId('met', obj.objectID),
    title: obj.title?.trim() || 'Senza titolo',
    titleAlt: '',
    artist: obj.artistDisplayName?.trim() || '',
    dateDisplay: obj.objectDate?.trim() || '',
    description,
    medium: obj.medium?.trim() || '',
    museum: dept ? `${museum} · ${dept}` : museum,
    department: dept,
    dimensions: obj.dimensions?.trim() || '',
    classifications,
    culture: obj.culture?.trim() || '',
    countries: placeToCountries(obj.country, obj.culture),
    imageUrl: ordered[0] ?? '',
    imageFocusX: 50,
    imageFocusY: 50,
    imageZoom: 1,
    orientation: 'portrait',
  }

  return { card, imageOptions: ordered.slice(0, 8) }
}

async function fetchWikidataArtwork(qid: string): Promise<{
  card: Omit<ArtCard, 'id' | 'createdAt'>
  imageOptions: string[]
}> {
  const cleanId = qid.replace(/[^Q0-9]/gi, '')
  const sparql = `
    SELECT ?workLabel ?image ?artistLabel ?date ?mediumLabel ?collectionLabel ?genreLabel WHERE {
      BIND(wd:${cleanId} AS ?work)
      OPTIONAL { ?work wdt:P18 ?image . }
      OPTIONAL { ?work wdt:P170 ?artist . }
      OPTIONAL { ?work wdt:P571 ?date . }
      OPTIONAL { ?work wdt:P186 ?medium . }
      OPTIONAL { ?work wdt:P195 ?collection . }
      OPTIONAL { ?work wdt:P136 ?genre . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    } LIMIT 8
  `
  const url =
    'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql)
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`Wikidata ${res.status}`)
  const data = (await res.json()) as {
    results?: {
      bindings?: {
        workLabel?: { value: string }
        image?: { value: string }
        artistLabel?: { value: string }
        date?: { value: string }
        mediumLabel?: { value: string }
        collectionLabel?: { value: string }
        genreLabel?: { value: string }
      }[]
    }
  }
  const rows = data.results?.bindings ?? []
  if (!rows.length) throw new Error('Opera Wikidata non trovata.')

  const first = rows[0]
  const images = uniqueStrings(
    rows.map((r) =>
      r.image?.value ? commonsFileUrl(r.image.value.replace(/^http:/, 'https:'), 843) : '',
    ),
  )
  const genres = uniqueStrings(rows.map((r) => r.genreLabel?.value))
  let dateDisplay = ''
  if (first.date?.value) {
    dateDisplay = first.date.value.slice(0, 10)
    if (/^\d{4}-/.test(dateDisplay)) dateDisplay = dateDisplay.slice(0, 4)
  }

  return {
    card: {
      number: 0,
      sourceId: encodeSourceId('wd', cleanId),
      title: first.workLabel?.value || 'Senza titolo',
      titleAlt: '',
      artist: first.artistLabel?.value || '',
      dateDisplay,
      description: '',
      medium: first.mediumLabel?.value || '',
      museum: first.collectionLabel?.value || '',
      department: '',
      dimensions: '',
      classifications: genres,
      culture: '',
      countries: [],
      imageUrl: images[0] ?? '',
      imageFocusX: 50,
      imageFocusY: 50,
      imageZoom: 1,
      orientation: 'portrait',
    },
    imageOptions: images.slice(0, 4),
  }
}

/**
 * Suggerimenti rapidi dal solo Met Museum.
 * Nota: non è TMDB — catalogo di un museo, lento per design (search → N detail).
 */
export async function searchArtworks(
  query: string,
  signal?: AbortSignal,
): Promise<ArtSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const wordCount = q.split(/\s+/).filter(Boolean).length
  // Nomi artista: artistOrCulture; titoli opera: ricerca generale
  const preferArtist = wordCount <= 3

  let ids = await metSearchIds(q, preferArtist, signal)
  if (ids.length === 0 && preferArtist) {
    ids = await metSearchIds(q, false, signal)
  }

  const top = ids.slice(0, SEARCH_DETAIL_LIMIT)
  const settled = await Promise.all(
    top.map(async (id) => {
      try {
        return await metGetObject(id, signal)
      } catch {
        return null
      }
    }),
  )

  return settled
    .filter((o): o is MetObject => !!o)
    .map(metToSearchResult)
    .filter((r): r is ArtSearchResult => !!r)
}

export async function fetchArtworkImages(sourceId: number | string): Promise<string[]> {
  const { provider, id } = parseSourceId(sourceId)
  if (provider === 'wd') {
    const { imageOptions } = await fetchWikidataArtwork(id)
    return imageOptions
  }
  const obj = await metGetObject(id)
  if (!obj) return []
  return metToCard(obj).imageOptions
}

export async function fetchArtworkForCard(
  sourceId: number | string,
): Promise<{ card: Omit<ArtCard, 'id' | 'createdAt'>; imageOptions: string[] }> {
  const { provider, id } = parseSourceId(sourceId)
  if (provider === 'wd') return fetchWikidataArtwork(id)
  const obj = await metGetObject(id)
  if (!obj) throw new Error('Opera non trovata nel Met Museum.')
  return metToCard(obj)
}
