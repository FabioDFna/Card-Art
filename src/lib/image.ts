import type { CardOrientation } from '../types'
import { orientationFromAspect } from '../types'

/** Ridimensiona e comprime un’immagine per la carta (~300 dpi). */
const MAX_EDGE_PX = 1000
const JPEG_QUALITY = 0.82
/** Sopra questa soglia si ricomprime anche una data URL già presente. */
const MAX_DATA_URL_CHARS = 450_000

export type CompressedImage = {
  dataUrl: string
  width: number
  height: number
  suggestedOrientation: CardOrientation
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Impossibile leggere l’immagine.'))
    img.src = src
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}

export async function compressImageSource(src: string): Promise<CompressedImage> {
  const img = await loadImage(src)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('Immagine non valida.')

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile.')
  ctx.fillStyle = '#0c0c0c'
  ctx.fillRect(0, 0, tw, th)
  ctx.drawImage(img, 0, 0, tw, th)

  let quality = JPEG_QUALITY
  let out = canvasToJpeg(canvas, quality)
  while (out.length > MAX_DATA_URL_CHARS && quality > 0.45) {
    quality -= 0.08
    out = canvasToJpeg(canvas, quality)
  }
  return {
    dataUrl: out,
    width: tw,
    height: th,
    suggestedOrientation: orientationFromAspect(tw, th),
  }
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleziona un file immagine.')
  }
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Lettura file fallita'))
    reader.readAsDataURL(file)
  })
  return compressImageSource(raw)
}

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_.\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isOversizedDataUrl(url: string): boolean {
  return url.startsWith('data:') && url.length > MAX_DATA_URL_CHARS
}

/** Comprime le immagini data URL troppo grandi già in collezione. */
export async function shrinkCardImages<T extends { imageUrl: string }>(
  cards: T[],
): Promise<T[]> {
  const next = [...cards]
  for (let i = 0; i < next.length; i++) {
    const url = next[i].imageUrl
    if (!isOversizedDataUrl(url)) continue
    try {
      const { dataUrl } = await compressImageSource(url)
      next[i] = { ...next[i], imageUrl: dataUrl }
    } catch {
      // lascia l’originale se la compressione fallisce
    }
  }
  return next
}
