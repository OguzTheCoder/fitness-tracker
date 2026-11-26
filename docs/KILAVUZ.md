# Uygulama Kılavuzu ve Plan

> **Kurallar:** Uygulamanın nasıl çalıştığını, kapsam sınırını ve yol haritasını özetler; kısa ve tekrar içermeyen biçimde tutulur. Bir karar değişince önce [KARARLAR.md](./KARARLAR.md), sonra bu dosya güncellenir.
> Güncel durum: [ILERLEME.md](./ILERLEME.md) · Tamamlananlar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) · Hatalar: [HATALAR.md](./HATALAR.md) · İndirmeler: [INDIRMELER.md](./INDIRMELER.md)

## 1. Kapsam Sınırı
- **Faz 1 (Zorunlu Teslim — `AUTH-1`..`AUTH-7`):** Kayıt, giriş, token tabanlı şifre sıfırlama ve entegrasyon testleri.
- **Faz 2 (Fitness Tracker MVP — `AUTH-8`..`AUTH-11`):** Ortak üst menülü ayrı sayfalar (`/dashboard`, `/weights`, `/calories`, `/workouts`), `YYYY-MM-DD` tarihli + `from`/`to` filtreli kayıtlar: günlük kilo (aynı gün upsert, `kg`, `not`), manuel kalori (serbest `öğün`, `kcal`, günlük toplam), antrenman (`ad`, `süre dk`, `not`), basit istatistik paneli (7/30/90 gün özet kartları + sıfır bağımlılıklı SVG kilo & kalori trend grafikleri).
- **Kapsam Dışı:** Dış yemek/barkod API, giyilebilir cihaz, admin/rol, sosyal özellik, makro/hedef hesabı, çoklu dil, mobil native.

## 2. Mimari ve Klasör Şablonu
- **Frontend (`frontend/`):** React + Vite + TypeScript + Tailwind CSS (Türkçe arayüz)
- **Backend (`backend/`):** Node.js + Express + TypeScript + Zod + JWT (Bearer) + `bcryptjs`
- **Veritabanı:** SQLite + Prisma ORM (`User`, `PasswordResetToken` + Faz 2: `WeightEntry`, `CalorieEntry`, `WorkoutEntry`)
- **Şifre Sıfırlama:** 15 dk süreli tek kullanımlık hash'lenmiş token + soyutlanmış `MailProvider`
- **Testler:** Vitest + Supertest (izole SQLite DB) ve Vitest + React Testing Library

```text
Fitness Tracker/
├── .gitignore            # AGENTS.md, docs/INDIRMELER.md, .env hariç
├── docs/                 # 6 takip dokümanı
├── backend/              # prisma/, src/{config,middlewares,modules,app.ts,server.ts}, tests/
└── frontend/             # src/{components,context,pages,services,App.tsx}, tests/
```

## 3. API Özeti
- **Faz 1 (`AUTH-4`..`AUTH-6`):** `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password`
- **Faz 2 (`AUTH-8`..`AUTH-11`, tümü Bearer JWT):**
  - `GET/POST /api/weights` (opsiyonel `?from&to`, `POST` aynı güne upsert) · `PUT/DELETE /api/weights/:id` (`AUTH-8`)
  - `GET/POST /api/calories` (opsiyonel `?from&to`) · `PUT/DELETE /api/calories/:id` (`AUTH-9`)
  - `GET/POST /api/workouts` (opsiyonel `?from&to`) · `PUT/DELETE /api/workouts/:id` (`AUTH-10`)
  - `GET /api/stats/summary?days=7|30|90` (`AUTH-11`)

## 4. Yol Haritası
**Faz 0 — Kurulum**
- [x] Jira (`AUTH`, 5 sütun, `AUTH-1`..`AUTH-7`) + Public GitHub repo + `GitHub for Jira`

**Faz 1 — Authentication (`In Progress → Branch → Smart Commit → PR/Code Review → Testing → Done`)**
- [x] `AUTH-4` Backend iskelet, Prisma/SQLite ve Register API
- [x] `AUTH-5` Backend Login ve `/me` API
- [x] `AUTH-6` Backend Şifre Sıfırlama API + `MailProvider`
- [x] `AUTH-1` Frontend iskelet ve Kayıt ekranı
- [x] `AUTH-2` Frontend Giriş ekranı ve JWT oturum yönetimi
- [x] `AUTH-3` Frontend Şifre Sıfırlama ekranları
- [x] `AUTH-7` Backend + Frontend entegrasyon testleri

**Faz 2 — Fitness Tracker MVP (Faz 1 `Done` sonrası)**
- [x] `AUTH-8` Günlük Kilo Takibi (`WeightEntry`, `/api/weights`, `AppLayout`, `/weights` + testler)
- [x] `AUTH-9` Manuel Kalori Takibi (`CalorieEntry`, `/api/calories`, `/calories` + günlük toplam + testler)
- [x] `AUTH-10` Antrenman Kaydı (`WorkoutEntry`, `/api/workouts`, `/workouts` + testler)
- [ ] `AUTH-11` İstatistik Paneli + Faz 2 Entegrasyon Testleri

## 5. Çalıştırma
- **Backend kurulum & migration:** `npm install --prefix backend` · `npm --prefix backend run prisma:migrate` · `npm --prefix backend run prisma:generate`
- **Backend geliştirme & derleme:** `npm --prefix backend run dev` · `npm --prefix backend run typecheck` · `npm --prefix backend run build`
- **Frontend kurulum & derleme:** `npm install --prefix frontend` · `npm --prefix frontend run dev` · `npm --prefix frontend run build`
- **Entegrasyon testleri:** `npm --prefix backend run test` · `npm --prefix frontend run test`
