import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { CardFace } from './components/CardFace'
import { CardForm } from './components/CardForm'
import { Collection } from './components/Collection'
import { ImagePicker } from './components/ImagePicker'
import { SearchBar } from './components/SearchBar'
import { downloadPdf, downloadPng, slugify } from './lib/exportCard'
import {
  captureCardPng,
  downloadCollectionSheetPdf,
  type SheetFace,
} from './lib/printSheet'
import {
  downloadCollectionBackup,
  loadCollection,
  mergeCollections,
  readCollectionFile,
  saveCollection,
  StorageQuotaError,
} from './lib/storage'
import { fetchArtworkForCard, normalizeImageUrl } from './lib/artworks'
import { emptyCard, normalizeCard, cardSizeMm, type ArtCard } from './types'
import type { ImageSelectMeta } from './components/ImagePicker'

type Draft = Omit<ArtCard, 'id' | 'createdAt'>

export default function App() {
  const [draft, setDraft] = useState<Draft>(emptyCard())
  const [collection, setCollection] = useState<ArtCard[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [imageOptions, setImageOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [flip, setFlip] = useState<'front' | 'back'>('front')
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focusX: number
    focusY: number
  } | null>(null)
  const [panning, setPanning] = useState(false)

  function clamp01to100(n: number): number {
    return Math.min(100, Math.max(0, n))
  }

  function clampZoom(n: number): number {
    return Math.min(3, Math.max(1, Math.round(n * 100) / 100))
  }

  function resetImageFrame() {
    setDraft((d) => ({ ...d, imageFocusX: 50, imageFocusY: 50, imageZoom: 1 }))
  }

  function onImagePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (flip !== 'front' || !draft.imageUrl) return
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focusX: draft.imageFocusX ?? 50,
      focusY: draft.imageFocusY ?? 50,
    }
    setPanning(true)
  }

  function onImagePointerMove(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const zoom = draft.imageZoom || 1
    const sensitivity = 100 / zoom
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    setDraft((d) => ({
      ...d,
      imageFocusX: clamp01to100(pan.focusX - (dx / rect.width) * sensitivity),
      imageFocusY: clamp01to100(pan.focusY - (dy / rect.height) * sensitivity),
    }))
  }

  function endImagePan(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    panRef.current = null
    setPanning(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // già rilasciato
    }
  }

  function onImageWheel(e: WheelEvent<HTMLDivElement>) {
    if (flip !== 'front' || !draft.imageUrl) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setDraft((d) => ({ ...d, imageZoom: clampZoom((d.imageZoom || 1) + delta) }))
  }

  useEffect(() => {
    let cancelled = false
    void loadCollection()
      .then((cards) => {
        if (cancelled) return
        setCollection(cards)
        setStorageReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setStorageReady(true)
        setStatus('Impossibile caricare la collezione salvata.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    void saveCollection(collection)
      .then(() => {
        if (cancelled) return
      })
      .catch((err) => {
        if (cancelled) return
        const msg =
          err instanceof StorageQuotaError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Salvataggio collezione fallito'
        setStatus(msg)
      })
    return () => {
      cancelled = true
    }
  }, [collection, storageReady])

  async function importArtwork(sourceId: string) {
    setBusy(true)
    setStatus(null)
    try {
      const { card, imageOptions: options } = await fetchArtworkForCard(sourceId)
      setDraft(card)
      setImageOptions(options)
      setSelectedId(null)
      setFlip('front')
      setStatus(
        options.length > 1
          ? `Importato. ${options.length} foto della stessa opera (scegline una).`
          : options.length === 1
            ? 'Opera importata — immagine intera sul fronte.'
            : 'Dati importati, ma senza immagine. Usa + per caricarla dal PC.',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import fallito')
    } finally {
      setBusy(false)
    }
  }

  function nextCardNumber(cards: ArtCard[]): number {
    const max = cards.reduce((acc, c) => Math.max(acc, c.number || 0), 0)
    return max + 1
  }

  function persistCard(andNew: boolean) {
    if (!draft.title.trim()) {
      setStatus('Serve almeno un titolo.')
      return
    }
    const now = new Date().toISOString()
    if (selectedId) {
      setCollection((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, ...draft } : c)),
      )
      if (andNew) {
        newCard()
        setStatus('Carta aggiornata. Pronto per la successiva.')
      } else {
        setStatus('Carta aggiornata.')
      }
      return
    }

    const number = draft.number > 0 ? draft.number : nextCardNumber(collection)
    const card: ArtCard = {
      ...draft,
      number,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    setCollection((prev) => [card, ...prev])
    if (andNew) {
      newCard()
      setStatus('Salvata. Carica la prossima immagine.')
    } else {
      setDraft((d) => ({ ...d, number }))
      setSelectedId(card.id)
      setStatus('Carta salvata in collezione.')
    }
  }

  function saveCard() {
    persistCard(false)
  }

  function saveCardAndNew() {
    persistCard(true)
  }

  function newCard() {
    setDraft(emptyCard())
    setImageOptions([])
    setSelectedId(null)
    setStatus(null)
    setFlip('front')
  }

  function loadCard(card: ArtCard) {
    const normalized = normalizeCard(card)
    const { id, createdAt: _createdAt, ...rest } = normalized
    void _createdAt
    setDraft({ ...rest, imageUrl: normalizeImageUrl(rest.imageUrl) })
    setSelectedId(id)
    setStatus(null)
    setImageOptions(rest.imageUrl ? [rest.imageUrl] : [])
    // Niente refetch Met: velocizza il riaperto dalla collezione
  }

  function applyImage(url: string, meta?: ImageSelectMeta) {
    const next = normalizeImageUrl(url)
    setDraft((d) => ({
      ...d,
      imageUrl: next,
      imageFocusX: 50,
      imageFocusY: 50,
      imageZoom: 1,
      orientation: meta?.suggestedOrientation ?? d.orientation,
      title:
        !d.title.trim() && meta?.suggestedTitle ? meta.suggestedTitle : d.title,
    }))
    setImageOptions((prev) => (prev.includes(next) ? prev : [next, ...prev]))
    setFlip('front')
  }

  function deleteCard(id: string) {
    setCollection((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) newCard()
  }

  async function withVisibleFaces<T>(fn: () => Promise<T>): Promise<T> {
    const slots = document.querySelectorAll<HTMLElement>('.preview-slot')
    const prev = [...slots].map((el) => el.style.opacity)
    slots.forEach((el) => {
      el.style.opacity = '1'
    })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    try {
      return await fn()
    } finally {
      slots.forEach((el, i) => {
        el.style.opacity = prev[i] ?? ''
      })
    }
  }

  async function exportSide(side: 'front' | 'back') {
    const node = side === 'front' ? frontRef.current : backRef.current
    if (!node) return
    setBusy(true)
    try {
      const base = slugify(draft.titleAlt || draft.title)
      await withVisibleFaces(() => downloadPng(node, `${base}-${side}.png`))
      setStatus(`Esportato ${side === 'front' ? 'fronte' : 'retro'} PNG.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export PNG fallito')
    } finally {
      setBusy(false)
    }
  }

  async function exportBothPdf() {
    if (!frontRef.current || !backRef.current) return
    setBusy(true)
    try {
      const base = slugify(draft.titleAlt || draft.title)
      await withVisibleFaces(() =>
        downloadPdf(
          frontRef.current!,
          backRef.current!,
          `${base}.pdf`,
          draft.orientation,
        ),
      )
      const { w, h } = cardSizeMm(draft.orientation)
      setStatus(`Esportato PDF fronte+retro (${w}×${h} mm).`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export PDF fallito')
    } finally {
      setBusy(false)
    }
  }

  function exportCollectionJson() {
    if (collection.length === 0) {
      setStatus('Nessuna carta da esportare.')
      return
    }
    downloadCollectionBackup(collection)
    setStatus(
      `Collezione esportata (${collection.length} carte). Copia il JSON sul altro PC e usa Importa.`,
    )
  }

  async function importCollectionJson(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const incoming = await readCollectionFile(file)
      if (incoming.length === 0) {
        setStatus('Il file non contiene carte.')
        return
      }

      const merge = window.confirm(
        `Importo ${incoming.length} carte.\n\nOK = unisci con la collezione attuale\nAnnulla = sostituisci tutta la collezione`,
      )

      if (merge) {
        const merged = mergeCollections(collection, incoming)
        setCollection(merged)
        setStatus(`Collezione unita: ora ${merged.length} carte.`)
      } else {
        setCollection(incoming)
        setStatus(`Collezione sostituita: ${incoming.length} carte.`)
      }

      setSelectedId(null)
      setDraft(emptyCard())
      setImageOptions([])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import fallito')
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  async function exportCollectionSheet() {
    if (collection.length === 0) {
      setStatus('Salva almeno una carta in collezione.')
      return
    }
    setBusy(true)
    setStatus(`Preparo foglio A4 (9 carte/pagina)… 0/${collection.length}`)
    try {
      const ordered = [...collection].sort((a, b) => (a.number || 0) - (b.number || 0))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => setTimeout(r, 50))

      const faces: SheetFace[] = []
      for (let i = 0; i < ordered.length; i++) {
        const card = ordered[i]
        const frontNode = document.querySelector<HTMLElement>(
          `.print-capture-host [data-card-id="${card.id}"][data-side="front"] .card-face`,
        )
        const backNode = document.querySelector<HTMLElement>(
          `.print-capture-host [data-card-id="${card.id}"][data-side="back"] .card-face`,
        )
        if (!frontNode || !backNode) {
          throw new Error(`Anteprima mancante per ${card.title}`)
        }
        const [front, back] = await Promise.all([
          captureCardPng(frontNode),
          captureCardPng(backNode),
        ])
        faces.push({
          front,
          back,
          orientation: card.orientation === 'landscape' ? 'landscape' : 'portrait',
        })
        setStatus(`Preparo foglio A4… ${i + 1}/${ordered.length}`)
      }

      await downloadCollectionSheetPdf(faces)
      setStatus(
        `PDF A4 pronto: ${ordered.length} carte (verticali 9/pagina, orizzontali 6/pagina). Stampa fronte-retro (lato lungo).`,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export foglio fallito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Collezione personale</p>
          <h1>Carte Arte</h1>
        </div>
        <p className="lede">
          Flusso veloce: carica immagine → titolo/artista → Salva e nuova. Scegli verticale o
          orizzontale; all’upload l’orientamento si propone da solo.
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <ImagePicker
            options={imageOptions}
            selected={draft.imageUrl}
            onSelect={applyImage}
          />
          <p className="field-label">2. Dati essenziali</p>
          <CardForm value={draft} onChange={setDraft} />
          <div className="panel-actions">
            <button type="button" className="btn btn-primary" onClick={saveCardAndNew} disabled={busy}>
              Salva e nuova
            </button>
            <button type="button" className="btn" onClick={saveCard} disabled={busy}>
              {selectedId ? 'Aggiorna' : 'Salva'}
            </button>
            <button type="button" className="btn" onClick={newCard} disabled={busy}>
              Pulisci
            </button>
          </div>
          {status && <p className="status">{status}</p>}
          <details className="optional-search">
            <summary>Aiuto opzionale: cerca nel Met Museum</summary>
            <SearchBar onSelect={importArtwork} disabled={busy} />
          </details>
        </aside>

        <main className="preview-panel">
          <div className="preview-toolbar">
            <div className="flip-toggle" role="group" aria-label="Lato carta">
              <button
                type="button"
                className={flip === 'front' ? 'is-on' : ''}
                onClick={() => setFlip('front')}
              >
                Fronte
              </button>
              <button
                type="button"
                className={flip === 'back' ? 'is-on' : ''}
                onClick={() => setFlip('back')}
              >
                Retro
              </button>
            </div>
            <div className="export-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => exportSide('front')}>
                PNG fronte
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => exportSide('back')}>
                PNG retro
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={exportBothPdf}>
                PDF stampa
              </button>
            </div>
          </div>

          <div className="preview-stage">
            <div
              className={`preview-stack ${flip}${draft.orientation === 'landscape' ? ' is-landscape' : ''}`}
            >
              <div
                className={`preview-slot front-slot${panning ? ' is-panning' : ''}`}
                aria-hidden={flip !== 'front'}
                onPointerDown={onImagePointerDown}
                onPointerMove={onImagePointerMove}
                onPointerUp={endImagePan}
                onPointerCancel={endImagePan}
                onWheel={onImageWheel}
              >
                <CardFace ref={frontRef} card={draft} side="front" />
              </div>
              <div className="preview-slot back-slot" aria-hidden={flip !== 'back'}>
                <CardFace ref={backRef} card={draft} side="back" />
              </div>
            </div>
          </div>
          {draft.imageUrl && flip === 'front' && (
            <div className="image-frame-bar">
              <p className="hint">Trascina per spostare · rotella per zoom</p>
              <button type="button" className="btn" onClick={resetImageFrame} disabled={busy}>
                Reset
              </button>
              <div className="image-frame-sliders">
                <label>
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={draft.imageZoom ?? 1}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, imageZoom: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Sinistra ↔ Destra
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.imageFocusX ?? 50}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, imageFocusX: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Alto ↕ Basso
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.imageFocusY ?? 50}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, imageFocusY: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
          <p className="hint">
            Orientamento:{' '}
            {draft.orientation === 'landscape' ? '88×63 mm (orizzontale)' : '63×88 mm (verticale)'}.
          </p>
        </main>

        <aside className="panel collection-panel">
          <h2 className="panel-title">Collezione ({collection.length})</h2>
          <div className="panel-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || collection.length === 0}
              onClick={exportCollectionSheet}
            >
              Foglio A4 (9/pagina)
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || collection.length === 0}
              onClick={exportCollectionJson}
            >
              Esporta JSON
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => importInputRef.current?.click()}
            >
              Importa JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void importCollectionJson(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="hint">
            Per passare da un PC all’altro: Esporta JSON, copia il file (USB/cloud), Importa JSON
            sull’altro PC. Il progetto va copiato a parte; la collezione non è nella cartella del
            codice.
          </p>
          <Collection
            items={collection}
            selectedId={selectedId}
            onSelect={loadCard}
            onDelete={deleteCard}
          />
        </aside>
      </div>

      <div className="print-capture-host" aria-hidden>
        {collection.map((card) => {
          const { id, createdAt: _c, ...face } = card
          void _c
          return (
            <div key={id} className="print-capture-card">
              <div data-card-id={id} data-side="front">
                <CardFace card={face} side="front" />
              </div>
              <div data-card-id={id} data-side="back">
                <CardFace card={face} side="back" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
