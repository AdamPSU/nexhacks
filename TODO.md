# Modernization TODO

## 1. Project Infrastructure & Dependencies
- [x] Install `@ai-sdk/google` for native Gemini integration via Vercel AI SDK.
- [x] Install `@supabase/ssr` to migrate from the legacy client to modern Next.js 16/React 19 patterns.
- [x] Upgrade any remaining dependencies to their latest stable 2025 versions.

## 2. Next.js & React 19 Modernization (Dashboard)
- [x] **Server Components**: Refactor `src/app/page.tsx` (Dashboard) to fetch data on the server instead of using `useEffect`.
- [x] **Server Actions**: Move database mutations (Create, Rename, Delete) from the client-side `supabase.ts` to a centralized `src/app/actions.ts`.
- [x] **Optimistic UI**: Implement `useOptimistic` for board renaming and deletion to ensure zero-latency UI updates.
- [x] **Action State**: Use `useActionState` for handling form feedback and loading states in the rename dialog. (Integrated via useTransition and server actions)

## 3. AI Modernization (Gemini & Voice)
- [ ] **Gemini Multimodal Live**: Replace OpenAI Realtime WebRTC in `src/hooks/useVoiceAgent.ts` with the Gemini 2.0/3.0 Multimodal Live API for native vision/audio streaming.
- [x] **Vercel AI SDK**: Refactor `src/app/api/generate-solution/route.ts` to use `generateText` from `@ai-sdk/google` instead of manual `fetch` calls.
- [ ] **Prompt Engineering**: Update `prompts/` to leverage latest Gemini system instruction features.

## 4. Architecture & UX
- [ ] **Supabase SSR Clients**: Implement the standard `createClient` pattern for Middleware, Server Components, and Actions.
- [x] **Canvas Optimization**: Refactored `useCanvasSolver.ts` to use an optimized viewport capture (JPEG format, 0.7 quality, 0.8 scale) to reduce latency and improve AI processing speed.

