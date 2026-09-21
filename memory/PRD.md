# FixMyCity — PRD

## Original Problem Statement
Full-stack civic issue reporting platform: citizens report local problems (roads, electricity, water, sanitation, streetlights) via photo + AI auto-categorization + GPS map pin; social feed with upvotes and status badges; live map; status tracking; gamification (points/badges/leaderboard); government admin dashboard (filters, worker assignment with deadlines, status updates with photo proof, analytics); field worker task view. Dark glassmorphism, futuristic premium UI, mobile-first citizen app. Seed 15-20 sample complaints. No real payments/SMS/gov-API (future scope).

## User Personas
- Citizen (mobile-first): reports issues, upvotes, tracks status, earns badges
- Admin / government officer (prathamgiri2005@gmail.com): triages complaints, assigns workers, views analytics
- Field worker: sees task queue with deadlines, completes with after-photo proof

## Architecture
- Frontend: React 19 + Tailwind + Framer Motion + react-leaflet (OSM tiles + CSS dark filter — keyless; user chose Google Maps but provided no key) + Recharts + sonner
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth (bcrypt, 7d tokens, localStorage `fmc_token`)
- AI: vision LLM (gpt-5.4-mini via EMERGENT_LLM_KEY) classifies uploaded photos into 6 categories with keyword fallback — `/api/issues/classify`
- Photos: local server storage `/app/backend/uploads`, served at `/api/uploads` (public read)
- Seed: idempotent, 20 issues across 8 Bengaluru areas, 5 citizens, 4 workers, 1 admin

## Implemented (2026-09-20, v1)
- Landing hero (animated grid/orbs, count-up stats, "Report it. Track it. Get it fixed.")
- Auth: register/login, role-based routing, one-click demo logins
- Report flow: photo upload → AI scanning overlay → detected category w/ confidence → editable category chips → draggable map pin + GPS → submit (+10 pts)
- Feed: staggered cards, category/status filters, recent/top/nearest sort w/ GPS distance, upvote toggle
- Map: drop-in animated pins, pulsing urgency rings, dark popups, status filters, legend
- My Reports: per-issue status timeline, resolution "after" photo, civic score + badges
- Leaderboard: podium + ranked rows with badges
- Admin: count-up metrics, 14-day trend area chart, status pie, category bar, hotspot areas, field-force roster; complaints table w/ filters; detail dialog (assign worker + deadline, In Progress, Resolve w/ photo proof)
- Worker view: deadline countdown chips (overdue pulse), Start Work, Mark Complete w/ after-photo (+15/+25 pts)
- Gamification: server-recomputed points/badges (First Report, Eagle Eye, Fix Finder, Community Hero, Pothole Patrol, Eco Guardian; worker: First Fix, Rapid Responder, City Guardian)

## Testing
- Iteration 1 (/app/test_reports/iteration_1.json): backend 25/26 pytest (1 test-side fix), frontend E2E all flows pass, mobile 390px verified, AI classify verified (source=ai, 93-99% confidence)

## Backlog
- P0: none
- P1: Google Maps swap when user provides API key (map layer isolated in IssueMap.jsx); notifications/SMS (future scope); real-time status push (currently simulated live-feel)
- P2: issue detail page w/ comments; duplicate detection via upvote clustering; exportable admin reports; PWA manifest + offline shell
