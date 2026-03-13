# E1 / creat8* Platform

## Overview

**E1** (branded as **creat8***) is a full-stack Web3 creator economy and social platform built on the **Base blockchain**. It allows content creators to tokenize their identity and content as tradeable ERC-20 coins via the Zora protocol, trade them on an open marketplace, and earn passive income through trading fees. The platform combines DeFi mechanics (coin trading, swaps, rewards) with social features (messaging, follow graphs, leaderboards, streaks) to create a complete creator monetization ecosystem.

**Primary users:** Content creators (writers, musicians, artists, influencers), Web3 community members, public goods builders (Gitcoin grantees, RPGF recipients, open source developers), and traders.

---

## User Preferences

- Preferred communication style: Simple, everyday language
- Currency display: Nigerian Naira (₦) — not USD ($)
- Primary color: `#A2CB8B` (soft sage green) — HSL `98 38% 67%`

---

## Feature Set

### 🪙 Creator Coins & Trading
- Creators mint ERC-20 tokens on Base via Zora protocol (Factory contract `0x777777751622c0d3258f214F9DF38E35BF45baF3`)
- Buy / Sell any creator coin directly from the platform using ETH
- Desktop trade modal (`trade-modal-desktop.tsx`) and mobile trade modal (`trade-modal-mobile.tsx`) with compact UI
- Real-time price, market cap, 24h volume, and holder data via Zora SDK + GeckoTerminal API
- Price charts generated from live coin data (Recharts)
- **Swap page** (`/swap`) — 0x Protocol Swap API for USDC ↔ WETH on Base (chain ID 8453)
- Coin detail page (`/coin/:address`) with full stats, chart, holders, activity, comments

### 👥 Social & Discovery
- **Explore / Home** (`/`) — scrollable live coin feed with market data
- **Search** (`/search`) — find creators and coins; search icon in header (desktop + mobile)
- **Creators** (`/creators`) — ranked list of creators (Top / Rising / New tabs), avatar click opens ProfileCardModal
- **Leaderboard** (`/leaderboard`) — sort creators by Market Cap, 24h Volume, or E1XP Points; medal badges for top 3
- **Public Profiles** (`/profile/:identifier`) — shareable creator profile pages
- **Top Creator Stories** — horizontal scrollable story strip on home feed
- **Follow / Unfollow** — social graph with follower/following counts, follow button on profile cards

### 💬 Social Interactions
- **Inbox / Direct Messaging** (`/inbox`) — threaded conversations with real-time unread badge via Socket.io
- **Comments** — per-coin comment threads, post from trade modal or detail page
- **Groups** (`/groups`) — community spaces with membership
- **Connections** (`/connections`) — broader social networking layer
- **ProfileCardModal** — rich popup on any avatar click with follow, market stats, coin portfolio

### 🔥 Gamification & Rewards
- **Daily Login Streaks** (`/streaks`) — consecutive check-in tracking, streak reset reminders
- **E1XP Points** (`/points`) — platform points earned from streaks, trading, referrals; claimable via modal
- **Referral System** (`/referrals`) — generate referral codes, track referees, earn on-chain rewards
- **Rewards** — on-chain claimable rewards tied to coin trading activity

### 🔔 Notifications
- In-app **Notification Bell** — real-time alerts (read, mark all read, delete)
- **Telegram Bot** — broadcasts: top coins, top creators, top earners, trending coins, recent trades, streak reminders, welcome messages, new coin promotions
- **Web Push Notifications** — browser push subscriptions for real-time alerts

### 🛠️ Content Creation (`/create`)
- Mint a new creator coin by linking a social platform (YouTube, Farcaster, Spotify, Gitcoin, TikTok, Instagram, Medium, Twitter, etc.)
- Upload media (image/video) or scrape a URL to pull metadata automatically
- IPFS metadata upload via Pinata for decentralized storage
- Auto-generates token symbol from platform/channel name
- Coin categories: Art, Music, Writing, Video, Gaming, Technology, Education, Community

### 👤 Profile & Settings
- Full profile editing: avatar, bio, display name, social links, creator type, categories
- Wallet connect via **Privy** (email, social, or Web3 wallet login)
- **Withdraw Earnings** modal — sends ETH earnings to wallet (gas-free via smart account where available)
- Dark / Light mode toggle (persisted in localStorage)

### 🔐 Admin Panel (`/admin`)
- Platform stats overview: total users, creators, coins, market cap, volume
- User management: earnings, E1XP, coin counts, admin promotion
- Creator management with same metrics
- Telegram broadcast triggers: top earners, trending coins, recent trades, welcome new users, promote new coins
- Admin messaging panel and network graph view
- Protected behind admin login (`/admin-login`)

### ⚡ Real-Time Infrastructure
- **Socket.io** — live unread message count, conversation updates
- Coin data auto-refreshes every 30 seconds
- Blockchain activity events from Base via Alchemy RPC

### 📱 Responsive Layout
- **Mobile**: Fixed top header (logo + search icon + inbox + notifications + theme + user menu) + fixed bottom nav (Explore, Swap, Create, Creators, Profile)
- **Desktop**: Collapsible sidebar (Explore, Creators, Leaderboard, Create, Swap + Resources/Profile sections) + top header (sidebar trigger + stats + search icon + theme + bell + create button + user menu)
- `useIsMobile()` hook drives layout switching

---

## System Architecture

### Frontend
- **React + TypeScript** via Vite
- **shadcn/ui** (Radix UI primitives) + **Tailwind CSS**
- **TanStack React Query v5** — server state, caching, invalidation
- **Wouter** — client-side routing
- **Wagmi + Viem** — Web3 wallet interaction and contract calls
- **Privy** — Web3 authentication (email, social, wallet)
- **Recharts** — price charts and analytics
- **Framer Motion** — animations
- **Embla Carousel** — media/chart carousels in trade modals
- **Socket.io client** — real-time messaging

### Backend
- **Express.js + TypeScript** on Node.js (port 5000)
- **Supabase** — managed PostgreSQL database
- **Drizzle ORM** — type-safe queries, schema in `shared/schema.ts`
- **Socket.io server** — real-time event broadcasting
- **Telegram Bot API** — community notifications and broadcasts
- **Pinata** — IPFS pinning for coin metadata
- **Alchemy** — Base blockchain RPC
- **node-cron** — scheduled jobs (streak resets, notification broadcasts)

### Key API Endpoints
- `GET/POST /api/coins` — coin listing, creation, metadata
- `GET /api/creators` — creator discovery with stats
- `POST /api/creators/sync` — sync creator profile from Privy/wallet
- `GET /api/zora/coins/top-volume` — live Zora data
- `GET /api/geckoterminal/*` — price pools and OHLCV data
- `POST /api/rewards` — record and distribute rewards
- `GET/POST /api/follows` — social follow graph
- `POST /api/referrals/generate` + `/apply` — referral system
- `GET/POST /api/messages` + `/api/messages/unread-count` — messaging
- `GET/POST /api/notifications` — in-app notifications CRUD
- `POST /api/notifications/send-*` — Telegram broadcast triggers
- `POST /api/login-streak/check-in` — daily streak recording
- `GET /api/blockchain/platform-stats` — on-chain aggregated data
- `GET /api/blockchain/activity-events` — live trading events
- `POST /api/auth/ensure-user` — Privy auth sync

### External Services
| Service | Purpose |
|---|---|
| **Zora Protocol** | Creator coin minting + SDK for live coin data |
| **0x Protocol** | Token swap quotes (USDC ↔ WETH on Base) |
| **GeckoTerminal** | Price pools, OHLCV chart data |
| **Alchemy** | Base blockchain RPC provider |
| **Privy** | Web3 authentication |
| **Supabase** | PostgreSQL hosting + connection pooling |
| **Pinata** | IPFS metadata storage |
| **Telegram Bot API** | Community notifications |
| **WalletConnect v2** | Wallet connection protocol |

### Data Schema (key tables)
- **users** — Privy ID, wallet address, social accounts, creator type, earnings, E1XP, referral codes
- **coins** — token address, chain ID, name, symbol, market data, IPFS metadata
- **comments** — per-coin comment threads
- **loginStreaks** — daily check-in tracking per user
- **notifications** — in-app notification queue
- **follows** — social follow graph (follower ↔ following wallet addresses)
- **referrals** — referral codes, referee tracking, reward status
- **scrapedContent** — imported content metadata

---

## File Structure (Key Files)
```
client/src/
  pages/
    home.tsx              # Explore feed
    creators.tsx          # Creator discovery (Top/Rising/New)
    leaderboard.tsx       # Ranked leaderboard (MCap/Vol/E1XP)
    coin-detail.tsx       # Full coin detail with chart + trade
    swap.tsx              # 0x Protocol token swap
    profile.tsx           # Authenticated user profile
    public-profile.tsx    # Shareable creator profile
    create.tsx            # Mint new creator coin
    inbox.tsx             # Direct messaging
    points.tsx            # E1XP points dashboard
    referrals.tsx         # Referral program
    streaks.tsx           # Login streak tracker
    admin.tsx             # Admin dashboard
    search.tsx            # Search creators + coins
  components/
    app-layout.tsx        # Sidebar + mobile nav + header
    trade-modal-desktop.tsx  # Desktop buy/sell modal
    trade-modal-mobile.tsx   # Mobile buy/sell modal
    profile-card-modal.tsx   # Avatar click popup
    top-creators-stories.tsx # Story strip
    notification-bell.tsx    # In-app notifications
    user-menu.tsx            # Authenticated user dropdown
    withdraw-earnings-modal.tsx  # ETH withdrawal flow

server/
  index.ts          # Server entry + Socket.io + Telegram init
  routes.ts         # All API routes (3000+ lines)
  supabase-storage.ts  # Supabase data access layer
  telegram-bot.ts   # Telegram bot handlers + broadcasts

shared/
  schema.ts         # Drizzle ORM schema + Zod types
```

---

## Environment Variables Required
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `VITE_PRIVY_APP_ID` — Privy authentication
- `VITE_ALCHEMY_KEY` — Alchemy RPC
- `VITE_WALLETCONNECT_PROJECT_ID` — WalletConnect
- `VITE_0X_API_KEY` — 0x Protocol swap quotes
- `TELEGRAM_BOT_TOKEN` — Telegram bot
- `PINATA_JWT` — IPFS uploads
- `DATABASE_URL` — Supabase PostgreSQL connection string
