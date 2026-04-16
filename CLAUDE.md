# cosmic-react-shell Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-16

## Active Technologies
- TypeScript 5.8 (strict), Node ≥ 18 for tooling — unchanged from 001. + React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui, `lucide-react` — unchanged. No OpenAI SDK; use `fetch` directly against `https://api.openai.com/v1/chat/completions` to keep bundle size and review surface minimal (per Constitution §IV). (002-ai-strategy-assistant)
- No change. Static JSON fixtures only. The assistant reads `EnrichedCase[]` from `services/cases.ts`; it writes nothing. (002-ai-strategy-assistant)

- TypeScript 5.8 (strict), Node ≥ 18 for tooling + React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui (Radix primitives), `lucide-react` icons (001-case-compass)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.8 (strict), Node ≥ 18 for tooling: Follow standard conventions

## Recent Changes
- 002-ai-strategy-assistant: Added TypeScript 5.8 (strict), Node ≥ 18 for tooling — unchanged from 001. + React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui, `lucide-react` — unchanged. No OpenAI SDK; use `fetch` directly against `https://api.openai.com/v1/chat/completions` to keep bundle size and review surface minimal (per Constitution §IV).

- 001-case-compass: Added TypeScript 5.8 (strict), Node ≥ 18 for tooling + React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui (Radix primitives), `lucide-react` icons

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
