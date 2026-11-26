# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 2 — Fitness Tracker MVP **TAMAMLANDI** (`AUTH-1`..`AUTH-11` kodlama ve tüm testler bitti; yalnızca `AUTH-11` commit/push/PR merge kaldı)
- **Aktif Branch:** `AUTH-11-stats-dashboard-tests`
- **Son Adım:** `AUTH-11` tamamlandı — `GET /api/stats/summary?days=7|30|90`, sıfır bağımlılıklı SVG `TrendChart`, 4 özet kart + 2 trend grafikli `DashboardPage`; Backend 26/26, Frontend 21/21 test (toplam 47/47) ve her iki `build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-11` değişikliklerini Smart Commit (`AUTH-11 ...`) ile commit edip `origin`'e push etmek, PR açıp `main`'e merge etmek ve Jira'da `AUTH-11`'i `Done` yapmak.
2. İsteğe bağlı: Uygulamayı yerelde canlı çalıştırıp (`npm --prefix backend run dev` & `npm --prefix frontend run dev`) uçtan uca görsel son kontrol yapmak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
