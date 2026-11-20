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