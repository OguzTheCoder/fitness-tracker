# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.5.0` (`AUTH-14` — Offline-First Senkron & 0 TL Model B Altyapısı) kodlama ve doğrulama tamamlandı (Backend 64/64, Frontend 41/41 test, `prisma:pg:validate` ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-14-offline-sync-model-b`
- **Son Adım:** Tüm kullanıcı tablolarına `deletedAt` tombstone migration'ı, sağlayıcıdan bağımsız 0 TL Model B PostgreSQL uyumu (`prisma:pg:*`, `TRUST_PROXY`, çoklu `CORS_ORIGIN`, `SERVE_FRONTEND`, `/api/ready`, `.env.example`), atomik delta/Last-Write-Wins `/api/sync` (`1mb` özel limit + hız sınırlayıcı + Zod + sıkı izolasyon), istemci IndexedDB + offline kuyruk + `AppLayout` durum göstergesi ve `/api/*` önbelleklemeyen güvenli PWA altyapısı tamamlandı.

## Sırada Ne Var?
1. `AUTH-14-offline-sync-model-b` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.5.0` etiketini oluşturmak.
2. `v2.0.0` (`AUTH-15`+) için yeni nesil PC + mobil PWA görsel tasarım kararlarını netleştirip uygulamaya geçmek.
3. `v2.0.0` ile birlikte 0 TL Model B canlı yayını ve uçtan uca doğrulamayı tamamlamak.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
