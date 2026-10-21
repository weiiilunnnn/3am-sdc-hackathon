# Design-system guide

## Existing visual identity

The source of truth is `src/frontend/app/globals.css`. Keep the current calm, light palette and typography; do not introduce unrelated branding.

| Token | Current value | Use |
|---|---|---|
| `--paper` | `#f3f5ed` | Page background |
| `--surface` | `#fffef9` | Panels and card surfaces |
| `--ink` | `#192b26` | Primary text |
| `--muted` | `#6e7b72` | Supporting text |
| `--line` | `#d9e1d6` | Borders and separators |
| `--green` | `#176a51` | Primary actions and chart lines |
| `--green-dark` | `#104c3b` | Hover and strong green text |
| `--lime` | `#d7eb88` | Brand accent |
| `--coral` | `#e9785b` | Secondary accent and synthetic-data cue |
| `--gold` | `#e5bd5b` | Caution highlight |
| `--blue` | `#4c7382` | Existing secondary data color |
| `--danger` | `#a33f38` | Error/danger text |

Typography uses DM Sans for body text, Manrope for display/brand headings, and DM Mono for compact metadata. Fonts are currently requested from Google Fonts in the stylesheet. The CSS also defines a restrained shared shadow.

## Layout and component conventions

- Shared navigation and page shell live in `src/frontend/app/AppShell.tsx`.
- Styling is currently class-based in one shared stylesheet; there is no UI component-library dependency. Reuse existing patterns such as `.panel`, `.field`, `.button`, `.message`, `.topic-card`, and `.chart`.
- Page content uses a centered maximum-width layout; forms and radar cards use CSS grids that collapse at narrow widths.
- Current responsive breakpoints are 850px and 680px. The narrow layout stacks form/radar content and allows the top navigation to scroll horizontally.
- Keep related data and source metadata together. Charts should retain readable axes/labels and source/period context.
- Use the existing radii and spacing rhythm; add a CSS variable only when a value is genuinely shared.

## Accessibility and interaction

- Use semantic HTML and programmatically associated labels. Preserve accessible names for icon-only controls, active-page state, and chart alternatives.
- Keep all interactive controls keyboard-operable and retain a clearly visible focus indication.
- Ensure text contrast and never communicate real/synthetic/unavailable status by color alone.
- Provide explanatory units, source, observation period, and retrieval date for data visualisations.
- Keep error, empty, and loading feedback readable as text and exposed with appropriate status semantics.
- Respect the existing `prefers-reduced-motion` rule when adding animation.

These conventions describe the current implementation; they are not a claim of formal accessibility certification. Test changed layouts and interactions at desktop and mobile widths.
