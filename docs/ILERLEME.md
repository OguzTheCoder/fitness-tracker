# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 2 — Fitness Tracker MVP (`AUTH-8` kodlama ve testleri tamamlandı; commit/push/PR merge bekliyor)
- **Aktif Branch:** `AUTH-8-daily-weight-tracking`
- **Son Adım:** `AUTH-8` (Günlük Kilo Takibi) tamamlandı — `WeightEntry` migration, `/api/weights` CRUD/upsert API, ortak `AppLayout` + `DateRangeFilter` + `/weights` UI; Backend 15/15, Frontend 10/10 test ve her iki `build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-8` değişikliklerini Smart Commit (`AUTH-8 ...`) ile commit edip `origin`'e push etmek, PR açıp `main`'e merge etmek.
2. `main`'i güncelleyip `AUTH-9-manual-calorie-tracking` dalında Manuel Kalori Takibi (`CalorieEntry`, `/api/calories`, `/calories` + günlük toplam + testler) ile devam etmek.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
