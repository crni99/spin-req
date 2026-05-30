# 🎧 SpinReq — DJ Song Request Platform

SpinReq is a **real-time DJ song request platform** built as a pure static web application — no backend, no registration, no complications. DJs create a party session, share the guest link, and manage incoming song requests live. Guests send requests directly from their phones, and the DJ accepts or rejects them in real time.

> **Powered by:** Vanilla HTML · CSS · JavaScript · Supabase (PostgreSQL + Realtime)

---

## ⭐ Live Demo

> **Note:** The database is hosted on **Supabase Free Tier**.
> - 🗄️ The project may enter **paused mode** after inactivity. On the initial request, please allow **1-2 minutes** for it to wake up.
> - 🔒 DJ panel access is protected by a **secure token** — only the party creator has DJ access.
> - 📡 All updates are **real-time** — no page refresh needed.

<table>
  <thead>
    <tr>
      <th>View</th>
      <th>Platform</th>
      <th>Link</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>SpinReq App</td>
      <td>
        <a href="https://YOUR_USERNAME.github.io/spin-req/">
          <img src="https://img.shields.io/badge/GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages Badge">
        </a>
      </td>
      <td>
        <a href="https://crni99.github.io/spin-req/">
          <b>Launch SpinReq 🡥</b>
        </a>
      </td>
    </tr>
  </tbody>
</table>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#-architecture)
- [🛫 Getting Started](#-getting-started)
- [🗄️ Database Setup](#-database-setup)
- [📁 Project Structure](#-project-structure)
- [🔐 Security](#-security)
- [🚀 Deployment](#-deployment)

---

<a name="-features"></a>
## ✨ Features

### DJ Panel
- Create a party session with a custom name, DJ name, and duration
- Dedicated **DJ URL** protected by a secure token — guests cannot access it
- Real-time incoming request queue with **Accept / Reject** controls
- **Drag & drop** reordering of accepted songs in the playlist
- Two-tab playlist view — **Accepted** (green) and **Rejected** (red)
- Extend party duration by **+30 minutes** at any time
- Manually end the party early
- **Export TXT** — full request list with accepted/rejected status at the end of the session
- Copy guest link with one click

### Guest View
- Access via simple party link — no registration required
- Send song requests directly to the DJ
- **3 requests per session** per user (browser fingerprint based)
- Live view of all accepted songs, sorted by DJ's custom order
- Party ended banner when session closes
- Countdown timer showing remaining party time

### Real-time
- All changes (new requests, accept/reject decisions, reorder, party end) propagate instantly via **Supabase Realtime**
- Smart render diffing — guest list only re-renders when data actually changes, preventing visual flickering

---

<a name="-architecture"></a>
## 🏗️ Architecture

SpinReq is a **100% static frontend** — there is no server-side code. All data persistence and real-time communication is handled by Supabase.

```
Browser (DJ)          Supabase
    │                    │
    │── INSERT party ──► │
    │── INSERT request ► │
    │── UPDATE status ─► │◄── Realtime ──► Browser (Guest)
    │◄─ Realtime ────────│
```

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime (WebSocket) |
| Hosting | GitHub Pages |
| Auth | Token-based (no login required) |

---

<a name="-getting-started"></a>
## 🛫 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/spin-req.git
cd spin-req
```

### 2. Set up Supabase
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Navigate to **SQL Editor** and run the setup script (see [Database Setup](#-database-setup))
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 3. Configure credentials
Open `js/supabase-config.js` and replace the placeholder values:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 4. Enable Realtime
In your Supabase dashboard:
- Go to **Database → Replication**
- Toggle **ON** for both `parties` and `requests` tables

### 5. Run locally
Open `index.html` directly in your browser or use a local server:

```bash
# Using VS Code Live Server extension (recommended)
# Or using Python:
python -m http.server 8080
```

> ⚠️ **Note:** Opening via `file://` protocol may cause navigation issues in some browsers. Use a local server for best results.

---

<a name="-database-setup"></a>
## 🗄️ Database Setup

Run the following SQL in your Supabase **SQL Editor**:

```sql
create table if not exists parties (
  id              text primary key,
  name            text not null,
  dj_name         text,
  duration_min    integer not null,
  end_timestamp   bigint not null,
  ended           boolean default false,
  created_at      timestamptz default now(),
  dj_token        text,
  top_song_1      text,
  top_song_2      text,
  top_song_3      text
);

create table if not exists requests (
  id          bigint generated always as identity primary key,
  party_id    text references parties(id) on delete cascade,
  song        text not null,
  ip_hash     text not null,
  status      text default 'pending',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.requests disable row level security;
alter table public.parties disable row level security;

create index if not exists requests_party_id_idx on public.requests (party_id);

create or replace function update_sort_orders(updates jsonb)
returns void language plpgsql as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(updates) loop
    update requests
    set sort_order = (item->>'sort_order')::int
    where id = (item->>'id')::bigint;
  end loop;
end;
$$;

-- Enable Row Level Security
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parties table
CREATE POLICY "Allow read parties" ON public.parties 
  FOR SELECT USING (true);

CREATE POLICY "Allow insert parties" ON public.parties 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update parties" ON public.parties 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Prevent party deletion" ON public.parties 
  FOR DELETE USING (false);

-- RLS Policies for requests table
CREATE POLICY "Allow read requests" ON public.requests 
  FOR SELECT USING (true);

CREATE POLICY "Allow insert requests" ON public.requests 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update requests" ON public.requests 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Prevent request deletion" ON public.requests 
  FOR DELETE USING (false);
```

### Schema Overview

**`parties`**
| Column | Type | Description |
|---|---|---|
| `id` | text | Unique party ID (6-char random) |
| `name` | text | Party name |
| `dj_name` | text | DJ display name (optional) |
| `duration_min` | integer | Initial duration in minutes |
| `end_timestamp` | bigint | Unix timestamp when party ends |
| `ended` | boolean | Whether party was manually ended |
| `dj_token` | text | Secure token for DJ panel access |

**`requests`**
| Column | Type | Description |
|---|---|---|
| `id` | bigint | Auto-increment ID |
| `party_id` | text | Reference to parent party |
| `song` | text | Song title as entered by guest |
| `ip_hash` | text | Browser fingerprint hash (rate limiting) |
| `status` | text | `pending` / `accepted` / `rejected` |
| `sort_order` | integer | DJ-defined display order |

---

<a name="-project-structure"></a>
## 📁 Project Structure

```
spin-req/
├── index.html              # App shell — HTML only, no inline JS or CSS
├── favicon.svg             # SVG favicon with brand gradient
├── css/
│   └── styles.css          # All styles — dark theme, components, animations
└── js/
    ├── supabase-config.js  # Supabase client + shared global state
    ├── ui.js               # Shared utilities — toast, timer, modal, helpers
    ├── dj.js               # DJ view — party creation, requests, drag & drop
    ├── guest.js            # Guest view — request form, quota, accepted list
    └── app.js              # Entry point — routing, realtime subscriptions
```

### Script loading order
Script order in `index.html` is **critical** — each file depends on globals from the previous:

```html
<script src="js/supabase-config.js"></script>  <!-- globals: supabaseClient, currentParty, ... -->
<script src="js/ui.js"></script>               <!-- globals: toast, showPage, buildUrl, ... -->
<script src="js/dj.js"></script>               <!-- uses: supabaseClient, toast, buildUrl, ... -->
<script src="js/guest.js"></script>            <!-- uses: supabaseClient, toast, ... -->
<script src="js/app.js"></script>              <!-- calls: init() — must be last -->
```

---

<a name="-security"></a>
## 🔐 Security

### DJ Token
The DJ panel is protected by a cryptographically random 32-character hex token generated at party creation:

```
Guest URL:  ?p=ABC123
DJ URL:     ?p=ABC123&dj=1&token=f3a9b2c1d4e5f6a7...
```

- Token is stored in the `parties` table and validated on every DJ view load
- Token is also persisted in `localStorage` so the DJ can refresh without losing access
- Without the correct token, any attempt to access the DJ panel redirects to the landing page

### Rate Limiting
Guest requests are limited to **3 per session** using a browser fingerprint hash (User Agent + timezone + screen width). This is MVP-grade protection suitable for party use cases.

> For stricter enforcement, a Supabase Edge Function with real IP detection can be implemented.

### Supabase `anon` Key
The Supabase `anon` key is intentionally public — it is designed to be embedded in frontend code. Access control is enforced at the database level via Row Level Security policies or by disabling RLS with application-level validation as implemented here.

---

<a name="-deployment"></a>
## 🚀 Deployment

SpinReq is deployed to **GitHub Pages** — no build step required.

### Deploy to GitHub Pages
1. Push the repository to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` → `/ (root)`
4. Your app will be live at `https://YOUR_USERNAME.github.io/spin-req/`

> ✅ No build tools, no Node.js, no CI/CD pipeline needed — GitHub Pages serves the static files directly.

---

## 🛠️ Built With

<div>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages">
</div>

---
