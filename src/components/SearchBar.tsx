import { useEffect, useRef, useState } from 'react'
import { searchArtworks } from '../lib/artworks'
import type { ArtSearchResult } from '../types'

type Props = {
  onSelect: (sourceId: string) => void
  disabled?: boolean
}

export function SearchBar({ onSelect, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArtSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const q = query.trim()
    abortRef.current?.abort()
    if (q.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    const t = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await searchArtworks(q, ac.signal)
        if (ac.signal.aborted) return
        setResults(list)
        setOpen(true)
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
        setResults([])
        setError(err instanceof Error ? err.message : 'Errore ricerca')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, 500)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [query])

  return (
    <div className="search" ref={wrapRef}>
      <label className="field-label" htmlFor="art-search">
        Aiuto opzionale: suggerimenti Met Museum
      </label>
      <input
        id="art-search"
        className="input"
        type="search"
        placeholder="Es. Caravaggio, Monet… (catalogo limitato)"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      <p className="hint">
        Non è come TMDB per i film: qui trovi solo pezzi del Met. Per il quadro giusto usa
        caricamento dal PC o URL.
      </p>
      {loading && <p className="hint">Cerco nel Met…</p>}
      {error && <p className="error">{error}</p>}
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="search-result"
                onClick={() => {
                  onSelect(m.id)
                  setQuery(m.title)
                  setOpen(false)
                }}
              >
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="poster-fallback" />
                )}
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {[m.artist, m.dateDisplay].filter(Boolean).join(' · ') || '—'}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="hint">Nessun pezzo nel Met. Carica l’immagine con + oppure da URL.</p>
      )}
    </div>
  )
}
