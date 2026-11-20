import type { ArtCard } from '../types'

type Props = {
  items: ArtCard[]
  selectedId: string | null
  onSelect: (card: ArtCard) => void
  onDelete: (id: string) => void
}

export function Collection({ items, selectedId, onSelect, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <p className="hint">
        Nessuna carta salvata. Cerca un’opera, ritocca i campi e salva — oppure carica un’immagine
        dal PC.
      </p>
    )
  }

  return (
    <ul className="collection">
      {items.map((c) => (
        <li key={c.id} className={c.id === selectedId ? 'is-active' : ''}>
          <button type="button" className="collection-item" onClick={() => onSelect(c)}>
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="poster-fallback" />
            )}
            <span>
              <strong>{c.title}</strong>
              <small>
                {[c.artist, c.dateDisplay].filter(Boolean).join(' · ') || '—'}
              </small>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            aria-label={`Elimina ${c.title}`}
            onClick={() => onDelete(c.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
