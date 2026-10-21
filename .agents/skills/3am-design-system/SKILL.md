---
name: 3am-design-system
description: Guides UI, layout, interaction, and accessibility changes in the 3AM Aiversecity app. Use before modifying frontend pages, components, or visual styles.
---

# 3AM Design System

Use this skill for frontend or visual changes. Inspect the existing page and `src/frontend/app/globals.css` before proposing new styles.

## Preserve the current identity

- Extend the existing light paper/cream, evergreen, lime, coral, and muted-blue palette. The current CSS variables are the source of truth; do not introduce a competing palette.
- Preserve the existing DM Sans body, Manrope display, and DM Mono metadata typography unless the user asks for a rebrand.
- Reuse the class-based patterns already in `globals.css` for panels, fields, buttons, messages, badges, and charts. There is no installed component-library dependency.
- Keep visual hierarchy clear and restrained. Do not redesign unrelated pages or add decorative effects that obscure meaning.

## Interaction and accessibility

- Inspect `src/frontend/app/AppShell.tsx` and existing page patterns before changing navigation or shared UI.
- Use semantic elements, explicit labels, keyboard-operable controls, visible focus states, and accessible status/error messages.
- Do not communicate real, synthetic, unavailable, or estimated data by color alone. Include text labels and source/date context.
- Charts need a meaningful accessible name and must preserve units, missing-period gaps, source, and observation dates.
- Keep layouts responsive. Existing breakpoints are 850px and 680px; at narrow widths, navigation scrolls horizontally and dashboard/form grids collapse.
- Respect `prefers-reduced-motion`; do not add motion that ignores the existing reduced-motion rule.

## Reference

Read [the design-system guide](../../../docs/design-system.md) for current token values, layout conventions, and accessibility checks. Update it only when a project-wide visual convention actually changes.
