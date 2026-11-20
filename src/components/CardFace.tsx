import { forwardRef } from 'react'
import { flagUrl } from '../lib/artworks'
import type { ArtCard } from '../types'
import { FitText } from './FitText'

type Draft = Omit<ArtCard, 'id' | 'createdAt'>

type Props = {
  card: Draft
  side: 'front' | 'back'
}

export const CardFace = forwardRef<HTMLDivElement, Props>(function CardFace(
  { card, side },
  ref,
) {
  if (side === 'front') {
    return (
      <div
        className={`card-face card-front${card.orientation === 'landscape' ? ' is-landscape' : ''}`}
        ref={ref}
      >
        {card.imageUrl ? (
          <img
            className="card-image"
            src={card.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            decoding="async"
            style={{
              transform: `translate(${50 - (card.imageFocusX ?? 50)}%, ${50 - (card.imageFocusY ?? 50)}%) scale(${card.imageZoom ?? 1})`,
            }}
          />
        ) : (
          <div className="card-image-empty">Nessuna immagine</div>
        )}
      </div>
    )
  }

  const titleAlt = card.titleAlt || ''
  const cultureLabel = card.culture && card.countries.length === 0 ? card.culture : ''

  return (
    <div
      className={`card-face card-back${card.orientation === 'landscape' ? ' is-landscape' : ''}`}
      ref={ref}
    >
      <header className="back-header">
        <div className="back-title-row">
          <FitText className="back-title" text={card.title || 'Titolo'} maxMm={7.2} minMm={3.4} />
        </div>
        {(card.artist || card.dateDisplay) && (
          <p className="back-subtitle-row">
            {card.artist && <span className="back-artist">{card.artist}</span>}
            {card.dateDisplay && <span className="back-year">{card.dateDisplay}</span>}
          </p>
        )}
        {titleAlt && <p className="back-title-alt">{titleAlt}</p>}
        {(card.countries.length > 0 || cultureLabel) && (
          <ul className="back-countries">
            {card.countries.map((code) => (
              <li key={code}>
                <img
                  src={flagUrl(code)}
                  alt={code}
                  width={22}
                  height={16}
                  referrerPolicy="no-referrer"
                />
              </li>
            ))}
            {cultureLabel && (
              <li className="back-culture-chip">
                <span>{cultureLabel}</span>
              </li>
            )}
          </ul>
        )}
      </header>

      <section className="back-section">
        <h3>Descrizione</h3>
        <p className="back-overview">{card.description || '—'}</p>
      </section>

      <section className="back-section back-credits">
        {card.artist && (
          <p className="back-credit-line">
            <span className="cred-label">Artista</span>
            <span>{card.artist}</span>
          </p>
        )}
        {card.medium && (
          <p className="back-credit-line">
            <span className="cred-label">Tecnica</span>
            <span>{card.medium}</span>
          </p>
        )}
        {card.museum && (
          <p className="back-credit-line">
            <span className="cred-label">Collezione</span>
            <span>{card.museum}</span>
          </p>
        )}
      </section>

      {(card.classifications.length > 0 || card.dimensions) && (
        <footer className="back-footer">
          {card.classifications.length > 0 && (
            <p className="back-genres">{card.classifications.join(' · ')}</p>
          )}
          {card.dimensions && <p className="back-runtime">{card.dimensions}</p>}
        </footer>
      )}
    </div>
  )
})
