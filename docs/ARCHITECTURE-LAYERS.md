# HOPE-V7 Architecture Layers

HOPE-V7 remains a modular monolith with explicit dependency direction. The goal is stronger boundaries without introducing microservice operational cost.

## Mobile
Presentation/widgets -> controllers/state -> application use cases -> repository interfaces -> DTO/model mapping -> API client -> HTTPS.

Application actions now include explicit use cases for authentication, marketplace creation/publication, job applications/offers/candidate actions, transactions and admin mutations. Repositories remain the data-access boundary; widgets do not know HTTP paths.

## Backend
HTTP/edge -> routes/controllers -> application use cases -> domain/policy -> repository ports -> infrastructure adapters.

Key lifecycle paths (jobs, applications, payments and admin mutations) use explicit application services in production PostgreSQL mode. Development file-mode fallbacks remain isolated for tests/local use and are not production persistence.

## Cross-cutting
Authentication context, authorization, validation, idempotency, transaction boundaries, outbox/events, provider ports, observability and audit are explicit cross-cutting boundaries.

## Non-goals
No microservice split, distributed event bus, or mandatory Redis layer was introduced. Those would add operational complexity without evidence that HOPE needs them yet.
