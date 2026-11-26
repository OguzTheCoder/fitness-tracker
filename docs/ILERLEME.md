# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.3.0` (`AUTH-12` — Esnek Antrenman, Şablonlar, Kardiyo & Adım) kodlama ve doğrulama tamamlandı (Backend 52/52, Frontend 34/34 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-12-workouts-cardio-steps`
- **Son Adım:** `Exercise`, `WorkoutTemplate`, `WorkoutTemplateExercise`, `WorkoutExercise`, `WorkoutSet`, `CardioEntry` ve `StepEntry` migration'ı, 46 kas bölgeli hazır egzersiz seed'i, `/api/exercises`, `/api/workout-templates`, v2 set/tekrar/ağırlık + önceki performans hatırlatmalı `/api/workouts`, beslenmeden bağımsız `/api/cardio`, profil hedefli günlük upsert `/api/steps`, güncel `/api/stats/summary` ve 4 sekmeli `/workouts` + `/dashboard` arayüzü tamamlandı.

## Sırada Ne Var?
1. `AUTH-12-workouts-cardio-steps` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.3.0` etiketini oluşturmak.
2. `main` üzerinden `AUTH-13` dalını açıp `v1.4.0` — Yedekleme & İçe Aktarma (`JSON` tam yedek/geri yükleme + `CSV` dışa aktarma) adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
