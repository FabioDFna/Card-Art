export type CardOrientation = 'portrait' | 'landscape'

export type ArtCard = {
  id: string
  number: number
  sourceId: number | string
  title: string
  titleAlt: string
  artist: string
  dateDisplay: string
  description: string
  medium: string
  museum: string
  department: string
  dimensions: string
  classifications: string[]
  culture: string
  countries: string[]
  imageUrl: string
  imageFocusX: number
  imageFocusY: number
  /** Zoom inquadratura (1 = opera intera, fino a ~3) */
  imageZoom: number
  /** Verticale 63×88 o orizzontale 88×63 */
  orientation: CardOrientation
  createdAt: string
}

export type ArtSearchResult = {
  /** es. "met:437422" o "wd:Q123" */
  id: string
  title: string
  artist: string
  dateDisplay: string
  imageUrl: string | null
}

function clampFocus(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(100, Math.max(0, v))
}

function clampZoom(n: unknown, fallback = 1): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(3, Math.max(1, Math.round(v * 100) / 100))
}

export function cardSizeMm(orientation: CardOrientation): { w: number; h: number } {
  return orientation === 'landscape' ? { w: 88, h: 63 } : { w: 63, h: 88 }
}

export function orientationFromAspect(width: number, height: number): CardOrientation {
  if (!width || !height) return 'portrait'
  return width >= height ? 'landscape' : 'portrait'
}

export const emptyCard = (): Omit<ArtCard, 'id' | 'createdAt'> => ({
  number: 0,
  sourceId: 0,
  title: '',
  titleAlt: '',
  artist: '',
  dateDisplay: '',
  description: '',
  medium: '',
  museum: '',
  department: '',
  dimensions: '',
  classifications: [],
  culture: '',
  countries: [],
  imageUrl: '',
  imageFocusX: 50,
  imageFocusY: 50,
  imageZoom: 1,
  orientation: 'portrait',
})

/** Compatibilità con carte salvate con campi mancanti o legacy. */
export function normalizeCard(
  raw: Partial<ArtCard> & {
    posterUrl?: string
    posterFocusX?: number
    posterFocusY?: number
    overview?: string
    tmdbId?: number
  },
): ArtCard {
  const base = emptyCard()
  const imageUrl = raw.imageUrl || raw.posterUrl || ''
  const orientation: CardOrientation =
    raw.orientation === 'landscape' || raw.orientation === 'portrait'
      ? raw.orientation
      : 'portrait'
  return {
    ...base,
    ...raw,
    number: raw.number ?? 0,
    sourceId: raw.sourceId ?? raw.tmdbId ?? 0,
    title: raw.title ?? '',
    titleAlt: raw.titleAlt ?? '',
    artist: raw.artist ?? '',
    dateDisplay: raw.dateDisplay ?? '',
    description: raw.description ?? raw.overview ?? '',
    medium: raw.medium ?? '',
    museum: raw.museum ?? '',
    department: raw.department ?? '',
    dimensions: raw.dimensions ?? '',
    classifications: raw.classifications ?? [],
    culture: raw.culture ?? '',
    countries: raw.countries ?? [],
    imageUrl,
    imageFocusX: clampFocus(raw.imageFocusX ?? raw.posterFocusX),
    imageFocusY: clampFocus(raw.imageFocusY ?? raw.posterFocusY),
    imageZoom: clampZoom(raw.imageZoom),
    orientation,
    id: raw.id ?? crypto.randomUUID(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
  }
}
