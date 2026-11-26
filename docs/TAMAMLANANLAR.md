# Tamamlanan Yapılar

> **Kurallar:**
> - Yalnızca **projede tamamlanıp doğrulanan uygulama yapıları/görevleri** (örn. `AUTH-4`, `AUTH-1`) kaydedilir.
> - Doküman oluşturma, planlama veya sohbet içi küçük düzenlemeler buraya **yazılmaz**.
> - Her kayıt tek satırda kısa tutulur; güncel durum ve sıradaki iş [ILERLEME.md](./ILERLEME.md) içindedir.

| Tarih | Görev | Tamamlanan Yapı | Doğrulama |
| :--- | :--- | :--- | :--- |
| 2026-11-25 | `AUTH-4` | `backend/` iskeleti (Express 5 + TS + Zod + JWT + `bcryptjs`), Prisma/SQLite `User` şeması (`init_user`) ve `POST /api/auth/register` + `GET /api/health`. | `tsc` + canlı HTTP testi (200/400/201/409/404) geçti. |
| 2026-11-25 | `AUTH-5` | `POST /api/auth/login`, `GET /api/auth/me` ve yeniden kullanılabilir Bearer JWT `authenticate` middleware'i. | `tsc` + 7 canlı HTTP senaryosu (login/me/401/200) geçti. |
| 2026-11-25 | `AUTH-6` | `PasswordResetToken` (15 dk, tek kullanımlık SHA-256 hash), `MailProvider` soyutlaması, `POST /api/auth/forgot-password` ve `POST /api/auth/reset-password`. | `tsc` + 8 canlı HTTP senaryosu (unknown/valid/invalid/reuse/login) geçti. |
| 2026-11-25 | `AUTH-1` | `frontend/` iskeleti (React 19 + Vite 6 + TS + Tailwind CSS), `api`/`authService`, `AuthLayout`/`FormField` ve Türkçe Kayıt ekranı (`RegisterPage`). | `tsc -b && vite build` 0 hatayla geçti. |
| 2026-11-25 | `AUTH-2` | `AuthContext` (JWT + `/api/auth/me` doğrulama + çıkış), `ProtectedRoute`, `LoginPage` ve korumalı `DashboardPage`. | `tsc -b && vite build` 0 hatayla geçti. |
| 2026-11-25 | `AUTH-3` | `ForgotPasswordPage` ve `ResetPasswordPage` (`?token=` desteği + doğrulama) ve `/forgot-password`, `/reset-password` rotaları. | `tsc -b && vite build` 0 hatayla geçti. |
| 2026-11-25 | `AUTH-7` | Backend (Vitest + Supertest + izole SQLite `test.db`) ve Frontend (Vitest + React Testing Library) entegrasyon test paketi. | Backend 10/10, Frontend 6/6 test ve her iki `build` geçti. |
| 2026-11-26 | `AUTH-8` | Günlük Kilo Takibi: `WeightEntry` şeması + migration, ortak `dateRange`, `/api/weights` CRUD/upsert API, ortak `AppLayout` + `DateRangeFilter`, `/weights` UI ve testler. | Backend 15/15, Frontend 10/10 test ve her iki `build` geçti. |
| 2026-11-26 | `AUTH-9` | Manuel Kalori Takibi: `CalorieEntry` şeması + migration, `/api/calories` CRUD + `dailyTotals` API, `/calories` günlük gruplu UI ve testler. | Backend 19/19, Frontend 14/14 test ve her iki `build` geçti. |
| 2026-11-26 | `AUTH-10` | Antrenman Kaydı: `WorkoutEntry` şeması + migration, `/api/workouts` CRUD + `summary` API, `/workouts` UI ve testler. | Backend 23/23, Frontend 18/18 test ve her iki `build` geçti. |
| 2026-11-26 | `AUTH-11` | Basit İstatistik Paneli & Faz 2 Testleri: `GET /api/stats/summary?days=7\|30\|90`, sıfır bağımlılıklı SVG `TrendChart`, 4 özet kart + 2 grafikli `DashboardPage` ve Faz 2 E2E testleri. | Backend 26/26, Frontend 21/21 test ve her iki `build` geçti. |
| 2026-11-26 | `AUTH-8` (`v1.0.1`) | Güvenlik Sertleştirmesi & Hijyen: `helmet`, IP+hesap hız sınırı, `User.tokenVersion` oturum iptali, `HS256`/`32+` JWT, atomik `reset-password`, prod mail kilidi, `16kb`/`.max(72)`/sayfalama sınırları, URL token temizliği, güvenli yönlendirme ve `.gitignore` hijyeni. | Backend 34/34, Frontend 24/24 test ve her iki `build` 0 hatayla geçti. |
| 2026-11-26 | `AUTH-9` (`v1.0.2`) | Kişisel Profil, Ortam Tabanlı Erişim/PIN Kilidi & `G-005` `HttpOnly` Çerez Oturumu: `UserProfile` migration + `/api/profile` (varsayılan `2000 kcal · 150P/200K/65Y`, `8000` adım, 6 mineral + katalog), `/api/access/*` (yerel isim / `APP_PIN` + rate-limit + `tokenVersion`), `/api/auth/logout*`, `localStorage` kaldırma, `/access` & `/profile` UI. | Backend 39/39, Frontend 29/29 test ve her iki `build` 0 hatayla geçti. |
| 2026-11-26 | `AUTH-10` (`v1.1.0`) | Beslenme Çekirdeği & Tarifler: `Food`/`Recipe`/`RecipeItem`/`NutritionLog` migration, 47 çekirdek temel besin seed'i, `/api/foods` + `/api/recipes` + snapshot'lı `/api/nutrition/logs` (porsiyon/gram/ayrıştırma, opsiyonel öğün etiketi, görünür mikro besin özetleri, `/api/stats/summary` entegrasyonu) ve 3 sekmeli `/nutrition` UI. | Backend 42/42, Frontend 31/31 test ve her iki `build` 0 hatayla geçti. |
