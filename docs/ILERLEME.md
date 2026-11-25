# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (`AUTH-4`, `AUTH-5`, `AUTH-6`, `AUTH-1` merge edildi; `AUTH-2` kodlama ve doğrulama tamamlandı)
- **Aktif Branch:** `AUTH-2-frontend-login-session`
- **Son Adım:** `AuthContext` (JWT saklama + `/api/auth/me` oturum doğrulama + `logout`), `ProtectedRoute`, `LoginPage` ve korumalı `DashboardPage` eklendi; `RegisterPage` oturum akışına bağlandı ve `tsc -b && vite build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-2` değişikliklerini Smart Commit (`AUTH-2 ...`) ile commit edip `origin`'e push etmek, PR açıp merge etmek.
2. `AUTH-3-frontend-password-reset` branch'ini açıp `ForgotPasswordPage` ve `ResetPasswordPage` (URL `?token=` desteği dahil) ekranlarını eklemek.
3. Son görev `AUTH-7` (Backend + Frontend entegrasyon testleri — Vitest, Supertest, React Testing Library) ile Faz 1'i tamamlamak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
