# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 2 — Fitness Tracker MVP (`AUTH-8` `Done`; `AUTH-9` kodlama ve testleri tamamlandı, commit/push/PR merge bekliyor)
- **Aktif Branch:** `AUTH-9-manual-calorie-tracking`
- **Son Adım:** `AUTH-9` (Manuel Kalori Takibi) tamamlandı — `CalorieEntry` migration, `/api/calories` CRUD + `dailyTotals` API, `/calories` günlük gruplu UI; Backend 19/19, Frontend 14/14 test ve her iki `build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-9` değişikliklerini Smart Commit (`AUTH-9 ...`) ile commit edip `origin`'e push etmek, PR açıp `main`'e merge etmek.
2. `main`'i güncelleyip `AUTH-10-workout-logging` dalında Antrenman Kaydı (`WorkoutEntry`, `/api/workouts`, `/workouts` + testler) ile devam etmek.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
