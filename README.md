# EventFlow

**An event-driven microservices platform for creating events, selling tickets and checking attendees in, built with NestJS, Apache Kafka and PostgreSQL.**

![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-7.5-231F20?logo=apachekafka&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Overview

EventFlow is the backend for a ticketing product (like a small Eventbrite):

- **Users** sign up, log in, browse published events and buy tickets.
- **Organisers** create events, publish or cancel them, see who bought tickets, and check attendees in at the door with a ticket code.
- **Notifications** (welcome emails, ticket confirmations, cancellations) are sent asynchronously and never slow down the request that triggered them.

The system is split into five NestJS services in a single monorepo. A client only talks to the **API Gateway**. The gateway authenticates the request and forwards it over HTTP to the right domain service. Domain services publish **Kafka** events whenever something important happens, and the **Notification Service** consumes those events to send emails.

### Highlights

- **Microservices in a NestJS monorepo**: 5 deployable apps and 3 shared libraries, each app built into its own Docker image from a single multi-stage `Dockerfile`.
- **API Gateway pattern**: one public entry point that validates the JWT once, rejects malformed payloads, passes the caller's identity to downstream services and returns their errors to the client with the original status code.
- **Event-driven side effects with Kafka**: domain services emit `user.*`, `event.*` and `ticket.*` events. Consumers subscribe with their own consumer group, so new consumers (analytics, search, payments) can be added without touching the producers.
- **Type-safe data layer**: the Drizzle ORM schema is the single typed source of truth for PostgreSQL tables, enums and inferred row types.
- **Shared contracts**: request DTOs with `class-validator` rules live in `libs/common` and are enforced at both the gateway and the owning service.
- **Business rules in the domain services**: capacity checks, ownership checks (organiser or admin), ticket state transitions and unique ticket codes.
- **Local stack in one command**: Docker Compose starts Kafka, Zookeeper, Kafka UI, PostgreSQL, Redis and MailHog for local email testing.

---

## Tech Stack

| Area | Technology |
| --- | --- |
| Language / runtime | TypeScript 6, Node.js 24 |
| Framework | NestJS 12 (monorepo mode), `@nestjs/microservices`, Express |
| Service-to-service (sync) | REST over HTTP via `@nestjs/axios` |
| Messaging (async) | Apache Kafka (Confluent 7.5) via `kafkajs` |
| Database | PostgreSQL 16, Drizzle ORM, `drizzle-kit`, `node-postgres` |
| Auth & security | Passport JWT, `@nestjs/jwt`, bcrypt password hashing |
| Validation | `class-validator`, `class-transformer`, global `ValidationPipe` |
| Email | Nodemailer, MailHog (SMTP sandbox for development) |
| Build & tooling | Nest CLI with Rspack, Oxlint, Prettier |
| Testing | Vitest, Supertest |
| Infrastructure | Docker (multi-stage builds), Docker Compose, Kafka UI |

---

## High-Level Design

### Architecture

```mermaid
flowchart LR
    client["Client<br/>web · mobile · curl"]

    subgraph edge["Edge"]
        gw["API Gateway :3000<br/>JWT auth · DTO validation · routing"]
    end

    subgraph domain["Domain services"]
        auth["Auth Service :3001<br/>users · login · JWT"]
        evt["Events Service :3003<br/>event lifecycle"]
        tkt["Tickets Service :3004<br/>purchase · cancel · check-in"]
    end

    subgraph async["Async workers"]
        notif["Notification Service :3006<br/>Kafka consumer"]
    end

    pg[("PostgreSQL<br/>users · events · tickets")]
    kafka{{"Apache Kafka"}}
    smtp["SMTP server<br/>MailHog in dev"]

    client -->|"HTTP + Bearer JWT"| gw
    gw -->|"REST"| auth
    gw -->|"REST + x-user-id, x-user-role"| evt
    gw -->|"REST + x-user-id"| tkt

    auth --> pg
    evt --> pg
    tkt --> pg

    auth -.->|"user.*"| kafka
    evt -.->|"event.*"| kafka
    tkt -.->|"ticket.*"| kafka
    kafka -.->|"subscribe"| notif
    notif --> smtp
```

**Communication model**

| Style | Used for | Why |
| --- | --- | --- |
| **Synchronous HTTP** (gateway → service) | Commands and queries where the client waits for an answer: login, create event, buy ticket | The client needs an immediate success or failure. |
| **Asynchronous Kafka events** (service → Kafka → consumers) | Side effects: emails now, and later analytics, payments and search indexing | Decouples producers from consumers. A slow or failing SMTP server can never fail a ticket purchase. |

**How identity is passed between services**

1. `auth-service` issues a JWT (`sub` = user id, `email`), signed with `JWT_SECRET` and valid for 1 day.
2. The **gateway** verifies the token with Passport JWT on every protected route. It does not call the auth service for this, so verification is stateless.
3. The gateway forwards the authenticated identity to downstream services as `x-user-id` (and `x-user-role` for events).
4. Domain services trust these headers and enforce **authorisation** themselves, for example "only the organiser of this event (or an `ADMIN`) can update, publish or cancel it".

> Domain services are meant to be reachable only on the internal network. The gateway is the only public surface.

### Services

| Service | Port | Responsibility | Owns / uses | Kafka |
| --- | --- | --- | --- | --- |
| **api-gateway** | 3000 | Public REST API, JWT verification, request validation, routing, error passthrough (returns `503` if a service is unreachable) | No database | None |
| **auth-service** | 3001 | Registration, login, profile. bcrypt-hashed passwords, issues JWTs | `users` | Produces `user.registered`, `user.login` |
| **events-service** | 3003 | Create, update, publish and cancel events. Public listing shows only published events | `events` | Produces `event.created`, `event.updated`, `event.cancelled` |
| **tickets-service** | 3004 | Purchase with capacity check, my tickets, cancel, organiser check-in, attendee list | `tickets` (reads `events`) | Produces `ticket.purchased`, `ticket.cancelled`, `ticket.checked-in` |
| **notification-service** | 3006 | Consumes domain events and sends HTML emails through SMTP. Exposes `GET /health` | None | Consumes `user.registered`, `ticket.purchased`, `ticket.cancelled` |

Ports `3002` (users-service) and `3005` (payments-service) are reserved in `libs/common` for upcoming services.

### Request flow: buying a ticket

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant GW as API Gateway
    participant TS as Tickets Service
    participant DB as PostgreSQL
    participant K as Kafka
    participant NS as Notification Service
    participant M as SMTP

    U->>GW: POST /tickets/purchase (eventId, quantity) with Bearer JWT
    GW->>GW: Verify JWT and validate DTO
    GW->>TS: POST /purchase with x-user-id header
    TS->>DB: Load event (must be PUBLISHED)
    TS->>DB: SUM(quantity) of CONFIRMED tickets for event
    alt quantity exceeds remaining capacity
        TS-->>GW: 400 Only N tickets remaining
        GW-->>U: 400
    else seats available
        TS->>DB: INSERT ticket (CONFIRMED, unique 12-char code)
        TS-)K: emit ticket.purchased
        TS-->>GW: 201 ticket details
        GW-->>U: 201 ticket details
        K-)NS: deliver ticket.purchased
        NS->>M: Send ticket confirmation email
    end
```

Registration works the same way: `auth-service` stores the user and emits `user.registered`, and the Notification Service sends a welcome email without the client waiting for it.

### Data model

```mermaid
erDiagram
    USERS ||--o{ EVENTS : "organises"
    USERS ||--o{ TICKETS : "buys"
    EVENTS ||--o{ TICKETS : "has"

    USERS {
        uuid id PK
        varchar email UK
        varchar password "bcrypt hash"
        varchar name
        enum role "USER, ORGANISER, ADMIN"
        timestamp created_at
        timestamp updated_at
    }
    EVENTS {
        uuid id PK
        varchar title
        text description
        timestamp date
        varchar location
        int capacity
        int price "minor units, default 0"
        enum status "DRAFT, PUBLISHED, CANCELLED"
        uuid organize_id FK
        timestamp created_at
        timestamp updated_at
    }
    TICKETS {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        int quantity
        int total_price "price x quantity"
        enum status "PENDING, CONFIRMED, CHECKED_IN, CANCELLED"
        varchar ticket_code UK
        timestamp purchased_at
        timestamp checked_in_at
        timestamp created_at
        timestamp updated_at
    }
```

Money is stored as **integers in minor units** (for example paise or cents) so there are no floating-point rounding errors.

### Lifecycles

**Event**: only `PUBLISHED` events appear in the public listing and can be ticketed.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> DRAFT: create
    DRAFT --> PUBLISHED: publish
    DRAFT --> CANCELLED: cancel
    PUBLISHED --> CANCELLED: cancel
```

**Ticket**: `PENDING` exists in the enum and is reserved for the upcoming payments flow.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> CONFIRMED: purchase
    CONFIRMED --> CHECKED_IN: organiser checks in code
    CONFIRMED --> CANCELLED: owner cancels
    CHECKED_IN --> [*]
    CANCELLED --> [*]
```

### Kafka topics

All payloads include an ISO-8601 `timestamp`. The full topic catalogue is in [`libs/kafka/src/constants/kafka.constants.ts`](libs/kafka/src/constants/kafka.constants.ts).

| Topic | Producer | Consumer | Effect |
| --- | --- | --- | --- |
| `user.registered` | auth-service | notification-service | Welcome email |
| `user.login` | auth-service | None yet | Available for audit and analytics |
| `event.created` | events-service | None yet | |
| `event.updated` | events-service | None yet | Payload lists the changed fields |
| `event.cancelled` | events-service | None yet | Planned: notify ticket holders |
| `ticket.purchased` | tickets-service | notification-service | Ticket confirmation email with code |
| `ticket.cancelled` | tickets-service | notification-service | Cancellation email |
| `ticket.checked-in` | tickets-service | None yet | |

Topics already reserved for upcoming features: `user.password-reset-requested`, `payment.completed`, `payment.failed`, `payment.refunded`, `notification.send-email`, `notification.send-push`.

---

## API Reference

All requests go through the gateway at `http://localhost:3000`. Protected routes need an `Authorization: Bearer <accessToken>` header. Request bodies are validated strictly: unknown fields are rejected with `400`.

### Auth

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Body `{ name, email, password }` (password ≥ 6 chars). Creates the user |
| `POST` | `/auth/login` | Public | Body `{ email, password }`. Returns `{ accessToken, user }` |
| `GET` | `/auth/profile` | JWT | Current user's profile |

### Events

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/events` | Public | List published events |
| `GET` | `/events/:id` | Public | Event details |
| `GET` | `/events/my-events` | JWT | Events organised by the caller, in any status |
| `POST` | `/events` | JWT | Body `{ title, description?, date, location, capacity, price? }`. Creates the event as `DRAFT` |
| `PUT` | `/events/:id` | JWT (organiser / admin) | Partial update |
| `POST` | `/events/:id/publish` | JWT (organiser / admin) | Make the event public and open for ticket sales |
| `POST` | `/events/:id/cancel` | JWT (organiser / admin) | Cancel the event |

### Tickets

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/tickets/purchase` | JWT | Body `{ eventId, quantity }` (1–10). Checks remaining capacity |
| `GET` | `/tickets/my-tickets` | JWT | Caller's tickets with event details |
| `GET` | `/tickets/:id` | JWT (owner) | Ticket details |
| `POST` | `/tickets/:id/cancel` | JWT (owner) | Cancel a ticket that has not been checked in |
| `POST` | `/tickets/check-in` | JWT (event organiser) | Body `{ ticketCode }`. Marks the ticket `CHECKED_IN` |
| `GET` | `/tickets/event/:eventId` | JWT (event organiser) | All tickets sold for an event |

---

## Project Structure

```
eventflow-app/
├── apps/
│   ├── api-gateway/            # Public HTTP entry point (:3000)
│   │   └── src/
│   │       ├── auth/           #   /auth/*    → auth-service
│   │       ├── events/         #   /events/*  → events-service
│   │       ├── tickets/        #   /tickets/* → tickets-service
│   │       └── jwt.strategy.ts #   Passport JWT verification
│   ├── auth-service/           # Users, bcrypt, JWT issuing (:3001)
│   ├── events-service/         # Event CRUD and lifecycle (:3003)
│   ├── tickets-service/        # Purchase, cancel, check-in (:3004)
│   └── notification-service/   # Kafka consumer → emails (:3006)
├── libs/
│   ├── common/                 # Shared DTOs, service names/ports, interfaces, utils
│   ├── database/               # Drizzle schema + global DatabaseService (pg pool)
│   └── kafka/                  # KafkaModule.register(groupId) + topic catalogue
├── Dockerfile                  # Multi-stage build; SERVICE build arg selects the app
├── docker-compose.yaml         # Infra (Kafka, Postgres, Redis, MailHog, Kafka UI) + services
├── drizzle.config.ts           # drizzle-kit config (schema → PostgreSQL)
└── nest-cli.json               # Nest monorepo: 5 applications, 3 libraries
```

Shared libraries are imported through path aliases: `@app/common`, `@app/database`, `@app/kafka`.

---

## Getting Started

### Prerequisites

- Node.js 24+ and npm
- Docker and Docker Compose

### 1. Install dependencies

```bash
git clone git@github.com:rathore-digvijay/eventflow-app.git
cd eventflow-app
npm install
```

### 2. Start the infrastructure

```bash
docker compose up -d zookeeper kafka kafka-ui postgres redis mailhog
```

| Component | URL / port |
| --- | --- |
| PostgreSQL | `localhost:5432` (user `eventflowapp`, db `eventflowapp`) |
| Kafka broker (from host) | `localhost:9093` |
| Kafka UI | http://localhost:8080 |
| MailHog inbox | http://localhost:8025 (SMTP on `1025`) |
| Redis | `localhost:6380` (provisioned for upcoming caching) |

### 3. Configure environment

Create a `.env` file in the repo root. All services share it.

```dotenv
DATABASE_URL=postgres://eventflowapp:eventflow_password@localhost:5432/eventflowapp
KAFKA_BROKER=localhost:9093
JWT_SECRET=change_me

# Used by the API gateway to reach downstream services
AUTH_SERVICE_URL=http://localhost:3001
EVENTS_SERVICE_URL=http://localhost:3003
TICKETS_SERVICE_URL=http://localhost:3004

# Used by the notification service
SMTP_HOST=localhost
SMTP_PORT=1025
```

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | auth, events, tickets, drizzle-kit |
| `KAFKA_BROKER` | auth, events, tickets, notification |
| `JWT_SECRET` | api-gateway, auth-service (must match) |
| `*_SERVICE_URL` | api-gateway |
| `SMTP_HOST`, `SMTP_PORT` | notification-service |

### 4. Create the database schema

```bash
DATABASE_URL=postgres://eventflowapp:eventflow_password@localhost:5432/eventflowapp npx drizzle-kit push
```

### 5. Run the services

Run each service in its own terminal, in watch mode:

```bash
npm run start:dev -- auth-service
npm run start:dev -- events-service
npm run start:dev -- tickets-service
npm run start:dev -- notification-service
npm run start:dev -- api-gateway
```

### 6. Try it end to end

```bash
# Register and log in
curl -s -X POST localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"secret123"}'

TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"secret123"}' | jq -r .accessToken)

# Create and publish an event
curl -s -X POST localhost:3000/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"NestJS Meetup","date":"2026-12-01T18:00:00Z","location":"Bengaluru","capacity":100,"price":49900}'

EVENT_ID=$(curl -s localhost:3000/events/my-events -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
curl -s -X POST localhost:3000/events/$EVENT_ID/publish -H "Authorization: Bearer $TOKEN"

# Buy two tickets
curl -s -X POST localhost:3000/tickets/purchase -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"eventId\":\"$EVENT_ID\",\"quantity\":2}"
```

Then open **http://localhost:8025** to see the welcome and ticket-confirmation emails, and **http://localhost:8080** to see the events on each Kafka topic.

### Running everything in Docker

Every service is built from the same `Dockerfile`. The `SERVICE` build argument selects which app to build:

```bash
docker build --build-arg SERVICE=auth-service -t eventflow/auth-service .
```

`docker compose up --build` builds and starts the infrastructure and all services together.

---

## Development

| Command | Description |
| --- | --- |
| `npm run build -- <app>` | Build one app into `dist/apps/<app>` (Rspack) |
| `npm run start:dev -- <app>` | Run one app in watch mode with `.env` loaded |
| `npm test` | Unit tests (Vitest) |
| `npm run test:cov` | Unit tests with coverage |
| `npm run lint` | Lint `apps/` and `libs/` with Oxlint |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | Type-check the whole monorepo |

---

## Design Decisions and Trade-offs

- **Authentication at the gateway, authorisation in the services.** JWTs are verified once at the edge, so downstream services stay stateless. Ownership and business rules belong to the domain, so services enforce them using the forwarded `x-user-id`. The trade-off is that domain services must not be exposed publicly.
- **Synchronous calls for commands, asynchronous events for side effects.** A purchase succeeds or fails on its own rules. Emails are sent in the background and cannot affect it.
- **One consumer group per service** (`KafkaModule.register('<group>')`). Each service gets its own copy of every event and can scale out horizontally within its group.
- **Shared database for now.** All services use one PostgreSQL instance, and `tickets-service` reads the `events` table directly for capacity checks. This keeps the system simple at this stage. Moving to database-per-service would mean replacing that read with an API call or a Kafka-fed local copy of the event data.
- **Contracts in shared libraries.** DTOs, the Drizzle schema, service ports and Kafka topic names each have a single definition, so services can't drift apart on names or shapes.

---

## Roadmap

- [ ] **Payments service** (port, topics and the `PENDING` ticket status are already reserved): reserve the ticket, then confirm it on `payment.completed`
- [ ] **Concurrency-safe capacity check**: run the capacity check and the insert in one transaction with a row lock, so two parallel purchases can't oversell an event
- [ ] **Role claims in the JWT** and role guards (`ORGANISER`, `ADMIN`) at the gateway
- [ ] **Richer notifications**: include the recipient's email in ticket events, and email every ticket holder on `event.cancelled`
- [ ] **Explicit event state-transition rules** (for example, a cancelled event can't be re-published)
- [ ] **Redis caching** for the public event listing (Redis is already provisioned)
- [ ] Versioned SQL migrations (`drizzle-kit generate`), OpenAPI/Swagger docs, end-to-end test suite
- [ ] Observability with distributed tracing (`@nestjs/observe` is already wired in the gateway and commented out)

---

## Author

**Digvijay Rathore**, [github.com/rathore-digvijay](https://github.com/rathore-digvijay)
