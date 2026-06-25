# Spun CRM

A full-stack, self-hostable **team CRM** built for an in-house sales team. Fully **Persian (Farsi) / RTL**, with a Jalali (Shamsi) calendar, Persian numerals, and Toman currency. Works on **mobile, tablet, and desktop** (responsive, touch-friendly UI).

> The interface is in Persian and renders right-to-left (`dir="rtl"`). This README is in English so the project is easy to set up by any developer.

---

## Features

- **Contacts** — people directory with company links, phone, email, notes, filtering, and one-click duplicate.
- **Companies** — organization records with industry, website, address.
- **Deals pipeline** — drag-and-drop Kanban board across stages (Lead → Won/Lost), value in Toman, probability, filtering.
- **Tasks** — assignable to-dos with priority and due dates.
- **Activities** — timeline of stage changes and notes per deal.
- **Calendar** — Jalali month grid with team (public) and personal (private) reminders. Reminders can be **outreach plans**: call / WhatsApp / SMS a chosen contact with a one-tap `tel:` / `wa.me` / `sms:` link and a custom message.
- **Team chat** — Slack-style channels + 1:1 direct messages, with replies and unread counts.
- **Dashboard** — KPIs and charts (deal value by stage, win rate, etc.).
- **Users & roles** — Owner / Admin / Member with enforced, DB-validated permissions.
- **Auth** — credentials login (email + password), JWT sessions, bcrypt hashing, login rate-limiting.

## Tech stack

| Area | Tech |
|------|------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, Tailwind CSS v4, Vazirmatn font, lucide icons, Recharts |
| Auth | Auth.js / NextAuth v5 (credentials + JWT), bcryptjs |
| Data | PostgreSQL + Prisma 6 |
| Dates | Jalali via `react-multi-date-picker` + `react-date-object` |
| Deploy | Docker Compose (app + Postgres + autoheal), Nginx + HTTPS |

---

## Quick start (local development)

### Prerequisites
- **Node.js 20+**
- **Docker** (for the local PostgreSQL) — or your own Postgres instance

### 1. Clone & install
```bash
git clone https://github.com/MGE-GOAT/CRM.git
cd CRM
npm install
```

### 2. Start a local PostgreSQL (Docker)
```bash
docker run -d --name crm-db \
  -e POSTGRES_USER=crm -e POSTGRES_PASSWORD=crm -e POSTGRES_DB=crm \
  -p 5544:5432 postgres:18-alpine
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` so the database URL matches the container above, and set an auth secret:
```ini
DATABASE_URL="postgresql://crm:crm@localhost:5544/crm?schema=public"
AUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Create the schema & seed demo data
```bash
npm run db:migrate     # apply migrations
npm run db:seed        # demo users, companies, contacts, deals, channels
```

### 5. Run it
```bash
npm run dev
```
Open **http://localhost:3000**.

### Demo logins (from the seed)
| Email | Password | Role |
|-------|----------|------|
| `admin@spun.local` | `password123` | مالک (Owner) |
| `reza@spun.local` | `password123` | مدیر (Admin) |
| `sara@spun.local` | `password123` | عضو (Member) |

> Change these before any real use. The seed is for local development only.

---

## Useful scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / run |
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:reset` | Drop & recreate the DB (destructive) |
| `npm run lint` | Lint |

---

## Responsive / device support

The UI is built mobile-first and verified across phone, tablet, and desktop widths:
- Collapsing sidebar with a mobile nav drawer.
- Forms stack to a single column on small screens; modals fit narrow viewports.
- Data tables scroll horizontally on phones instead of clipping.
- Kanban columns size to the screen; touch-friendly action buttons.
- Explicit viewport configuration and a Jalali calendar that adapts to width.

---

## Production deployment

A full Docker-based deployment (app + Postgres + autoheal, Nginx reverse proxy, HTTPS) is documented in **[DEPLOY.md](./DEPLOY.md)**, with disaster recovery in **[RESTORE.md](./RESTORE.md)**.

In short:
```bash
cp .env.production.example .env   # fill in real secrets
docker compose up -d --build
```
Then put Nginx (or any reverse proxy) in front with a TLS certificate, pointing `your-subdomain` at the app on `127.0.0.1:3000`. See `deploy/` for the sample Nginx config.

---

## Project structure

```
src/
├── app/
│   ├── (app)/            # authenticated app: dashboard, contacts, companies,
│   │                     # deals, tasks, calendar, chat, settings/users
│   ├── login/            # auth entry
│   └── api/              # route handlers (NextAuth)
├── components/           # UI: sidebar, modal, forms, chat, calendar, charts
├── lib/
│   ├── actions/          # server actions (contacts, deals, chat, users, …)
│   ├── auth.ts / rbac.ts # auth + role checks
│   └── format.ts         # Jalali dates, Persian digits, Toman
└── proxy.ts              # route protection (Next 16 middleware)
prisma/                   # schema, migrations, seed
```

## Security notes

- Never commit `.env` — only the `.env.example` / `.env.production.example` templates are tracked.
- All server actions validate input (Zod) and re-check authorization against the database on every request.
- Set a strong `AUTH_SECRET` and rotate the seeded demo passwords before real use.

## License

Private project. All rights reserved unless a license file is added.
