import { useRef, useState } from 'react'
import { compressImageFile, compressImageSource, titleFromFilename } from '../lib/image'
import { toImageThumb } from '../lib/artworks'
import type { CardOrientation } from '../types'

export type ImageSelectMeta = {
  suggestedOrientation?: CardOrientation
  suggestedTitle?: string
}

type Props = {
  options: string[]
  selected: string
  onSelect: (url: string, meta?: ImageSelectMeta) => void
}

function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

export function ImagePicker({ options, selected, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const compressed = await compressImageFile(file)
      onSelect(compressed.dataUrl, {
        suggestedOrientation: compressed.suggestedOrientation,
        suggestedTitle: titleFromFilename(file.name),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento immagine fallito')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleUrl() {
    const raw = urlDraft.trim()
    if (!raw) return
    if (!/^https?:\/\//i.test(raw) && !raw.startsWith('data:')) {
      setError('Incolla un URL http(s) di un’immagine.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      try {
        const compressed = await compressImageSource(raw)
        onSelect(compressed.dataUrl, {
          suggestedOrientation: compressed.suggestedOrientation,
        })
      } catch {
        onSelect(raw)
      }
      setUrlDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'URL non utilizzabile')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="poster-picker">
      <p className="field-label">1. Immagine (dal PC o URL)</p>
      <div className="poster-picker-grid">
        {options.map((url) => (
          <button
            key={isDataUrl(url) ? `local-${url.length}-${url.slice(-40)}` : url}
            type="button"
            className={`poster-option${url === selected ? ' is-selected' : ''}`}
            onClick={() => onSelect(url)}
            aria-pressed={url === selected}
            disabled={uploading}
          >
            <img
              src={isDataUrl(url) ? url : toImageThumb(url)}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </button>
        ))}
        <button
          type="button"
          className={`poster-option poster-upload${isDataUrl(selected) ? ' is-selected' : ''}`}
          onClick={() => inputRef.current?.click()}
          title="Carica immagine dal PC"
          disabled={uploading}
        >
          <span className="poster-upload-icon">{uploading ? '…' : '+'}</span>
        </button>
      </div>
      <div className="url-import">
        <input
          className="input"
          type="url"
          placeholder="Oppure incolla URL immagine…"
          value={urlDraft}
          disabled={uploading}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleUrl()
            }
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={uploading || !urlDraft.trim()}
          onClick={() => void handleUrl()}
        >
          Usa URL
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
