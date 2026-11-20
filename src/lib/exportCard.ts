import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { cardSizeMm, type CardOrientation } from '../types'

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Incorpora le immagini esterne come data URL così l’export non si rompe per CORS. */
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
        const dataUrl = await blobToDataUrl(await res.blob())
        img.src = dataUrl
      } catch {
        // lascia l’URL originale
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

async function nodeToPng(node: HTMLElement): Promise<string> {
  const restore = await inlineExternalImages(node)
  try {
    return await toPng(node, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: '#0c0c0c',
    })
  } finally {
    restore()
  }
}

export async function downloadPng(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await nodeToPng(node)
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export async function downloadPdf(
  front: HTMLElement,
  back: HTMLElement,
  filename: string,
  orientation: CardOrientation = 'portrait',
): Promise<void> {
  const { w, h } = cardSizeMm(orientation)
  const [frontUrl, backUrl] = await Promise.all([nodeToPng(front), nodeToPng(back)])
  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [w, h],
  })
  pdf.addImage(frontUrl, 'PNG', 0, 0, w, h)
  pdf.addPage([w, h], orientation === 'landscape' ? 'landscape' : 'portrait')
  pdf.addImage(backUrl, 'PNG', 0, 0, w, h)
  pdf.save(filename)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'carta'
}
