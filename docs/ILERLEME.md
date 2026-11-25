# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (`AUTH-4`, `AUTH-5`, `AUTH-6`, `AUTH-1`, `AUTH-2` merge edildi; `AUTH-3` kodlama ve doğrulama tamamlandı)
- **Aktif Branch:** `AUTH-3-frontend-password-reset`
- **Son Adım:** `ForgotPasswordPage` ve `ResetPasswordPage` (URL `?token=` okuma + manuel token girişi + şifre eşleşme doğrulaması) eklendi ve `AppRoutes`'a bağlandı; `tsc -b && vite build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-3` değişikliklerini Smart Commit (`AUTH-3 ...`) ile commit edip `origin`'e push etmek, PR açıp merge etmek.
2. Faz 1'in son görevi `AUTH-7-integration-tests` branch'ini açıp Backend (Vitest + Supertest + izole SQLite DB) ve Frontend (Vitest + React Testing Library) entegrasyon testlerini yazıp çalıştırmak.
3. `AUTH-7` merge edildikten sonra Faz 1 tamamen `Done` olacak ve yeni sohbette Faz 2 (`AUTH-8`+) başlayacak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
