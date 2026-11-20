# Carte Arte

Gestionale personale per carte collezionabili di **opere d’arte / quadri**.

## Approccio (importante)

Per i **film**, TMDB è pensato per ricerca + poster. Per i **quadri** non esiste un equivalente universale.

**Flusso veloce consigliato**

1. Carica immagine (+) o URL
2. Titolo + artista (+ orientamento se serve)
3. **Salva e nuova** → ripeti

L’orientamento (**verticale 63×88** / **orizzontale 88×63**) si propone dall’aspect ratio dell’immagine e si può cambiare a mano.

La ricerca Met Museum resta solo un aiuto opzionale (chiusa di default).

## Feature

- Fronte: opera **intera** (`object-fit: contain`)
- Retro: metadati leggibili in stampa 63×88 mm
- Collezione IndexedDB + Esporta/Importa JSON
- PNG / PDF carta / foglio A4 9 per pagina

## Setup

```bash
npm install
npm run dev
```

Nessuna API key richiesta.

## Stampa

| Formato | Misure |
|--------|--------|
| Carta | **63 × 88 mm**, angoli 3 mm |
| Foglio A4 | 3×3 = 9 carte, duplex con colonne retro specchiate |

---

# Carte Arte

Personal manager for collectible cards of **artworks / paintings**.

## Approach (important)

For **movies**, TMDB is built for search plus posters. For **paintings** there is no universal equivalent.

**Recommended quick flow**

1. Upload an image (+) or paste a URL
2. Title + artist (+ orientation if needed)
3. **Save and new** → repeat

Orientation (**portrait 63×88** / **landscape 88×63**) is suggested from the image aspect ratio and can be changed by hand.

Met Museum search stays an optional helper (closed by default).

## Features

- Front: the **whole** artwork (`object-fit: contain`)
- Back: metadata readable when printed at 63×88 mm
- IndexedDB collection + JSON export/import
- PNG / single-card PDF / A4 sheet, 9 cards per page

## Setup

```bash
npm install
npm run dev
```

No API key required.

## Print

| Format | Size |
|--------|------|
| Card | **63 × 88 mm**, 3 mm corners |
| A4 sheet | 3×3 = 9 cards, duplex with mirrored back columns |
