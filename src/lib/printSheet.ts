import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'
import { cardSizeMm, type CardOrientation } from '../types'

const PAGE_W = 210
const PAGE_H = 297
const GAP_MM = 1.5

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function inlineExternalImages(root: HTMLElement): Promise<() => void> {
  const imgs = [...root.querySelectorAll('img')]
  const backups = imgs.map((img) => ({ img, src: img.getAttribute('src') ?? '' }))

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:')) return
      try {
        const res = await fetch(src, { mode: 'cors', referrerPolicy: 'no-referrer' })
        if (!res.ok) return
        img.src = await blobToDataUrl(await res.blob())
      } catch {
        // keep original
      }
    }),
  )

  return () => {
    for (const { img, src } of backups) {
      if (src) img.setAttribute('src', src)
      else img.removeAttribute('src')
    }
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll('img')]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

export async function captureCardPng(node: HTMLElement): Promise<string> {
  await waitForImages(node)
  const restore = await inlineExternalImages(node)
  try {
    return await toPng(node, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: '#0c0c0c',
    })
  } finally {
    restore()
  }
}

export type SheetFace = {
  front: string
  back: string
  orientation: CardOrientation
}

type Grid = { cols: number; rows: number; cardW: number; cardH: number }

function gridFor(orientation: CardOrientation): Grid {
  const { w, h } = cardSizeMm(orientation)
  if (orientation === 'landscape') {
    // 88×63 → 2×3 = 6 carte/pagina
    return { cols: 2, rows: 3, cardW: w, cardH: h }
  }
  // 63×88 → 3×3 = 9 carte/pagina
  return { cols: 3, rows: 3, cardW: w, cardH: h }
}

function sheetOrigin(g: Grid): { x0: number; y0: number } {
  const gridW = g.cols * g.cardW + (g.cols - 1) * GAP_MM
  const gridH = g.rows * g.cardH + (g.rows - 1) * GAP_MM
  return {
    x0: (PAGE_W - gridW) / 2,
    y0: (PAGE_H - gridH) / 2,
  }
}

function cellPosition(g: Grid, index: number, mirrorCols: boolean): { x: number; y: number } {
  const row = Math.floor(index / g.cols)
  let col = index % g.cols
  if (mirrorCols) col = g.cols - 1 - col
  const { x0, y0 } = sheetOrigin(g)
  return {
    x: x0 + col * (g.cardW + GAP_MM),
    y: y0 + row * (g.cardH + GAP_MM),
  }
}

function drawGuides(pdf: jsPDF, g: Grid) {
  const { x0, y0 } = sheetOrigin(g)
  const gridW = g.cols * g.cardW + (g.cols - 1) * GAP_MM
  const gridH = g.rows * g.cardH + (g.rows - 1) * GAP_MM
  pdf.setDrawColor(180)
  pdf.setLineWidth(0.1)
  pdf.rect(x0, y0, gridW, gridH)
}

function appendOrientationSheets(
  pdf: jsPDF,
  faces: SheetFace[],
  orientation: CardOrientation,
  startBlank: boolean,
): boolean {
  const subset = faces.filter((f) => f.orientation === orientation)
  if (subset.length === 0) return startBlank

  const g = gridFor(orientation)
  const perPage = g.cols * g.rows
  let first = startBlank

  for (let i = 0; i < subset.length; i += perPage) {
    const chunk = subset.slice(i, i + perPage)

    if (!first) pdf.addPage('a4', 'portrait')
    first = false
    drawGuides(pdf, g)
    chunk.forEach((face, idx) => {
      const { x, y } = cellPosition(g, idx, false)
      pdf.addImage(face.front, 'PNG', x, y, g.cardW, g.cardH)
    })

    pdf.addPage('a4', 'portrait')
    drawGuides(pdf, g)
    chunk.forEach((face, idx) => {
      const { x, y } = cellPosition(g, idx, true)
      pdf.addImage(face.back, 'PNG', x, y, g.cardW, g.cardH)
    })
  }

  return first
}

/**
 * PDF A4: pagine separate per verticale (3×3) e orizzontale (2×3).
 * Pagine alternate fronte / retro, colonne del retro specchiate.
 */
export async function downloadCollectionSheetPdf(
  faces: SheetFace[],
  filename = 'carte-arte-foglio-a4.pdf',
): Promise<void> {
  if (faces.length === 0) throw new Error('Nessuna carta da stampare.')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let blank = true
  blank = appendOrientationSheets(pdf, faces, 'portrait', blank)
  blank = appendOrientationSheets(pdf, faces, 'landscape', blank)
  void blank

  pdf.save(filename)
}

export const CARDS_PER_SHEET = 9
export { cardSizeMm }
