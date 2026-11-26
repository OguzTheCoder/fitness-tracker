# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.1.0` (`AUTH-10` — Beslenme Çekirdeği & Tarifler) kodlama ve doğrulama tamamlandı (Backend 42/42, Frontend 31/31 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-10-nutrition-core-recipes`
- **Son Adım:** `Food`/`Recipe`/`RecipeItem`/`NutritionLog` Prisma şeması + migration, 47 çekirdek besin seed'i, `/api/foods` + `/api/recipes` + snapshot kilitli `/api/nutrition/logs` (porsiyon/gram/ayrıştırma + profil görünür mikro besin özetleri), `/api/stats/summary` entegrasyonu ve 3 sekmeli `/nutrition` arayüzü tamamlandı.

## Sırada Ne Var?
1. `AUTH-10-nutrition-core-recipes` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.1.0` etiketini oluşturmak.
2. `main` üzerinden `AUTH-11` dalını açıp `v1.2.0` — Barkod / QR & Önbellekli Ürün Arama adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
