# Uygulama Kılavuzu ve Plan

> **Kurallar:** Uygulamanın nasıl çalıştığını, kapsam sınırını ve yol haritasını özetler; kısa ve tekrar içermeyen biçimde tutulur. Bir karar değişince önce [KARARLAR.md](./KARARLAR.md), sonra bu dosya güncellenir.
> Güncel durum: [ILERLEME.md](./ILERLEME.md) · Tamamlananlar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) · Hatalar: [HATALAR.md](./HATALAR.md) · İndirmeler: [INDIRMELER.md](./INDIRMELER.md)

## 1. Kapsam Sınırı
- **Faz 1 (Zorunlu Teslim — `AUTH-1`..`AUTH-7`):** Kayıt, giriş, token tabanlı şifre sıfırlama ve entegrasyon testleri.
- **Faz 2 (Fitness Tracker MVP — `AUTH-8`+):** Günlük kilo (tarih, kg, not), manuel kalori (tarih, öğün, kcal), antrenman kaydı (tarih, ad, süre, not), basit istatistik paneli (özet kartlar + trend grafiği).
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

## 3. Faz 1 API Özeti
- `POST /api/auth/register` (`AUTH-4`) — Kullanıcı kaydı → JWT + profil
- `POST /api/auth/login` (`AUTH-5`) — Giriş → JWT + profil
- `GET /api/auth/me` (`AUTH-5`) — Aktif kullanıcı bilgisi (Bearer JWT)
- `POST /api/auth/forgot-password` (`AUTH-6`) — Süreli sıfırlama token'ı + `MailProvider`
- `POST /api/auth/reset-password` (`AUTH-6`) — Token doğrulama + yeni şifre

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
- [ ] `AUTH-8` Günlük Kilo Takibi · `AUTH-9` Manuel Kalori · `AUTH-10` Antrenman Kaydı · `AUTH-11` İstatistik Paneli + Testler

## 5. Çalıştırma
- **Backend kurulum & migration:** `npm install --prefix backend` · `npm --prefix backend run prisma:migrate` · `npm --prefix backend run prisma:generate`
- **Backend geliştirme & derleme:** `npm --prefix backend run dev` · `npm --prefix backend run typecheck` · `npm --prefix backend run build`
- **Frontend kurulum & derleme:** `npm install --prefix frontend` · `npm --prefix frontend run dev` · `npm --prefix frontend run build`
- **Entegrasyon testleri:** `npm --prefix backend run test` · `npm --prefix frontend run test`
