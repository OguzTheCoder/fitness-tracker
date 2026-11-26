# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 2 — Fitness Tracker MVP (`AUTH-8`, `AUTH-9` `Done`; `AUTH-10` kodlama ve testleri tamamlandı, commit/push/PR merge bekliyor)
- **Aktif Branch:** `AUTH-10-workout-logging`
- **Son Adım:** `AUTH-10` (Antrenman Kaydı) tamamlandı — `WorkoutEntry` migration, `/api/workouts` CRUD + `summary` API, `/workouts` UI; Backend 23/23, Frontend 18/18 test ve her iki `build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-10` değişikliklerini Smart Commit (`AUTH-10 ...`) ile commit edip `origin`'e push etmek, PR açıp `main`'e merge etmek.
2. `main`'i güncelleyip `AUTH-11-stats-dashboard-tests` dalında Basit İstatistik Paneli (`/api/stats/summary`, Dashboard 4 özet kart + 7/30/90 gün seçici + sıfır bağımlılıklı SVG kilo & kalori trend grafikleri) ve Faz 2 uçtan uca entegrasyon testlerini tamamlamak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
