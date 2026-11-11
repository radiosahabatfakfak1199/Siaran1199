# Project memory

## Product intent & audience

- Single-page web audio player, mobile-first, dark-themed
- Radio panel style UI with MP3 upload and custom audio controls
- Built with Vite + React + Tailwind; icons from `lucide-react`; `@/` path alias for imports

## Brand personality & voice

- Retro radio aesthetic; frequency display ("11.99 FM") mimics a physical tuner readout
- User communicates in Indonesian; assistant should respond in Indonesian

## Visual design & UX direction

- Dark theme overall; accent green box used as a frequency/frequency-like display panel
- Green box: 3D, not flat — diagonal gradient `#3fe0a2` (top-left) → `#1fa971` (bottom-right)
- Green box shadow stack: `inset 0 2px 0 rgba(255,255,255,.35)`, `inset 0 -10px 24px rgba(0,0,0,.35)`, `inset 0 0 40px rgba(0,0,0,.25)`, `0 12px 28px rgba(0,0,0,.6)`
- "FM" label rendered as a small unit suffix to the bottom-right of the numeric value, baseline-aligned via `flex items-end` (not stacked)
- Numeric readout keeps existing text color and sizing unchanged
- Mobile-first layout; verify positioning on actual mobile viewport after changes

## Decisions, constraints & rationale

- Scope discipline: user requested only the green box be modified; other UI areas must remain untouched
- 3D treatment chosen to make the green panel feel like a physical radio display rather than flat
- Baseline-aligned suffix pattern preferred over stacked labels for radio-unit realism

## Open questions & assumptions

- Exact vertical offset of "FM" relative to the number baseline may need fine-tuning after visual inspection on mobile
- No confirmation yet of on-device rendering; visual review pending