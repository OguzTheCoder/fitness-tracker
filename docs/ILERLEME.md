# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (Backend Auth API'leri `AUTH-4`, `AUTH-5`, `AUTH-6` tamamlandı)
- **Aktif Branch:** `AUTH-6-backend-password-reset`
- **Son Adım:** `PasswordResetToken` Prisma modeli/migration'ı, `MailProvider` (`ConsoleMailProvider` + `MemoryMailProvider`), `POST /api/auth/forgot-password` ve `POST /api/auth/reset-password` uç noktaları eklendi; `tsc` ve 8 canlı HTTP senaryosu doğrulandı.

## Sırada Ne Var?
1. `AUTH-6` değişikliklerini Smart Commit (`AUTH-6 ...`) ile commit edip `origin`'e push etmek, PR açıp merge etmek.
2. `AUTH-1-frontend-iskelet-register` branch'ini açıp `frontend/` iskeletini (React + Vite + TypeScript + Tailwind CSS, Türkçe arayüz) ve Kayıt ekranını kurmak.
3. Ardından `AUTH-2` (Giriş + JWT oturum), `AUTH-3` (Şifre Sıfırlama ekranları) ve `AUTH-7` (Entegrasyon Testleri) ile Faz 1'i tamamlamak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
