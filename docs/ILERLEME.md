# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (`AUTH-4` merge edildi; `AUTH-5` kodlama ve doğrulama tamamlandı)
- **Aktif Branch:** `AUTH-5-backend-login-me`
- **Son Adım:** `POST /api/auth/login`, `GET /api/auth/me` ve Bearer JWT doğrulama middleware'i (`authenticate`) eklendi; `tsc` ve 7 canlı HTTP senaryosu doğrulandı.

## Sırada Ne Var?
1. `AUTH-5` değişikliklerini Smart Commit (`AUTH-5 ...`) ile commit edip `origin`'e push etmek, PR açıp merge etmek.
2. `AUTH-6-backend-password-reset` branch'ini açıp `PasswordResetToken` modeli, `MailProvider` soyutlaması, `POST /api/auth/forgot-password` ve `POST /api/auth/reset-password` uç noktalarını yazmak.
3. Ardından Frontend (`AUTH-1`, `AUTH-2`, `AUTH-3`) ve Entegrasyon Testleri (`AUTH-7`) ile Faz 1'i tamamlamak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
