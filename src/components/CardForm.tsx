import type { ArtCard } from '../types'

type Draft = Omit<ArtCard, 'id' | 'createdAt'>

type Props = {
  value: Draft
  onChange: (next: Draft) => void
}

export function CardForm({ value, onChange }: Props) {
  const set = <K extends keyof Draft>(key: K, v: Draft[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="card-form">
      <div className="form-grid">
        <label className="field field-span">
          <span className="field-label">Titolo</span>
          <input
            className="input"
            value={value.title}
            onChange={(e) => set('title', e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field-label">Artista</span>
          <input
            className="input"
            value={value.artist}
            onChange={(e) => set('artist', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Anno / data</span>
          <input
            className="input"
            placeholder="1889 o c. 1500–1510"
            value={value.dateDisplay}
            onChange={(e) => set('dateDisplay', e.target.value)}
          />
        </label>
      </div>

      <fieldset className="orient-fieldset">
        <legend className="field-label">Orientamento carta</legend>
        <div className="flip-toggle" role="group" aria-label="Orientamento">
          <button
            type="button"
            className={value.orientation !== 'landscape' ? 'is-on' : ''}
            onClick={() => set('orientation', 'portrait')}
          >
            Verticale 63×88
          </button>
          <button
            type="button"
            className={value.orientation === 'landscape' ? 'is-on' : ''}
            onClick={() => set('orientation', 'landscape')}
          >
            Orizzontale 88×63
          </button>
        </div>
      </fieldset>

      <details className="form-more">
        <summary>Altri campi (opzionali)</summary>
        <div className="form-grid">
          <label className="field field-span">
            <span className="field-label">Titolo alternativo</span>
            <input
              className="input"
              value={value.titleAlt}
              onChange={(e) => set('titleAlt', e.target.value)}
            />
          </label>
          <label className="field field-span">
            <span className="field-label">Tecnica / medium</span>
            <input
              className="input"
              value={value.medium}
              onChange={(e) => set('medium', e.target.value)}
            />
          </label>
          <label className="field field-span">
            <span className="field-label">Museo / collezione</span>
            <input
              className="input"
              value={value.museum}
              onChange={(e) => set('museum', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Cultura / origine</span>
            <input
              className="input"
              value={value.culture}
              onChange={(e) => set('culture', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Paesi (ISO)</span>
            <input
              className="input"
              value={value.countries.join(', ')}
              placeholder="IT, FR"
              onChange={(e) =>
                set(
                  'countries',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <label className="field field-span">
            <span className="field-label">Dimensioni opera</span>
            <input
              className="input"
              placeholder="120 × 90 cm"
              value={value.dimensions}
              onChange={(e) => set('dimensions', e.target.value)}
            />
          </label>
          <label className="field field-span">
            <span className="field-label">Classificazioni / stile</span>
            <input
              className="input"
              value={value.classifications.join(', ')}
              placeholder="Impressionismo, Olio su tela"
              onChange={(e) =>
                set(
                  'classifications',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <label className="field field-span">
            <span className="field-label">Descrizione</span>
            <textarea
              className="input textarea"
              rows={3}
              value={value.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
        </div>
      </details>
    </div>
  )
}
