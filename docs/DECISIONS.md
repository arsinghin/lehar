# Decision records

Short records of the choices that shape the codebase.

### ADR-1: Deterministic core, AI at the edges

**Decision.** Budgets, schedules, trade-offs and diffs are pure functions. The AI handles only ideas,
free-text change parsing and vendor questions.
**Why.** Families need numbers they can trust: an AI must never invent prices. Pure functions are exact,
explainable, fast, testable and work offline.
**Trade-off.** Estimates rely on curated assumptions, which are documented, labelled and editable.

### ADR-2: Rules before AI for change parsing

**Decision.** `parseChangeText` runs first. The AI is consulted only when it understands nothing.
**Why.** Typical changes ("50 more guests", "2 weeks earlier") are parsed instantly and exactly, at zero
cost, and keep working when free quotas run out. Vague inputs get a clarifying question, never a guess.

### ADR-3: Free-tier providers with an enforced allowlist

**Decision.** Gemini 3.8 Flash → Gemini 3.1 Flash-Lite → OpenRouter `nvidia/nemotron-3.5-lightning:free`
→ NVIDIA NIM `nvidia/nemotron-3.5-lightning-30b-a3b` → rules. Non-free ids are rejected in code. The two
free endpoints share one OpenAI-compatible client (`server/ai/providers/openaiCompatible.ts`), run with
reasoning off and get 22 s each, so both fit inside the 50 s deadline.
**Why.** The owner requires zero cost risk. Flash with LOW thinking balances accuracy and latency,
Flash-Lite is the fastest fallback on the same key, Nemotron 3.5 Lightning is a fast free model reachable
through two independent providers, and rules guarantee availability.

### ADR-4: React + Vite SPA with Vercel Functions, no framework server

**Decision.** A static SPA plus two Web-standard functions.
**Why.** Smallest attack surface and bundle, CDN-served, simple to reason about. The plan lives in the
browser, so there is no database to secure.

### ADR-5: zod/mini everywhere

**Decision.** Use `zod/mini` for all schemas, in the browser and on the server.
**Why.** One schema module validates storage, API requests, model output and browser responses, and also
generates the model's JSON schema, at a fraction of full zod's bundle cost.

### ADR-6: In-memory rate limiting and caching

**Decision.** Per-instance token windows and an LRU cache.
**Why.** No extra services or keys are needed on the free plan, and Fluid compute reuses warm instances.
**Next step at scale.** A shared store such as Vercel KV.

### ADR-7: Strict CSP without `unsafe-inline`

**Decision.** No inline scripts or styles. Progress uses `<progress>`, and the budget bar uses SVG
attributes.
**Why.** It closes the main XSS escalation path. CI fails if the built HTML contains inline script or
style, and an e2e test runs the app under the production CSP.

### ADR-8: Single branch, no Dependabot

**Decision.** Updates happen manually on `main`.
**Why.** A small project with one maintainer stays simplest with a linear history on `main`. Dependency
updates are reviewed by hand, and `npm audit` runs in CI.
