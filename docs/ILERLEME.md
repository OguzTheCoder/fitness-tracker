# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.4.0` (`AUTH-13` — Yedekleme & İçe Aktarma) kodlama ve doğrulama tamamlandı (Backend 58/58, Frontend 37/37 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-13-backup-export-import`
- **Son Adım:** Sürümlü (`schemaVersion: 1`) tam JSON dışa aktarma, UTF-8 BOM + formül enjeksiyon korumalı 6 tabloluk CSV dışa aktarma (`weights`, `nutrition`, `workouts`, `cardio`, `steps`, `calories`), tek Prisma transaction içinde atomik ve Zod doğrulamalı `POST /api/backup/import` (`merge` [`keep_existing` / `prefer_backup`] & `overwrite`, `5 MB` özel gövde sınırı, hız sınırlayıcı, sıkı kullanıcı/çekirdek izolasyonu) ve `/profile` yedekleme arayüzü tamamlandı.

## Sırada Ne Var?
1. `AUTH-13-backup-export-import` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.4.0` etiketini oluşturmak.
2. `main` üzerinden `AUTH-14` dalını açıp `v1.5.0` — Offline-First Senkron & 0 TL Model B Altyapısı (PostgreSQL uyumu, `/api/sync`, IndexedDB kuyruk ve PWA) adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
