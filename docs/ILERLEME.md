# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.2.0` (`AUTH-11` — Barkod / QR & Önbellekli Ürün Arama) kodlama ve doğrulama tamamlandı (Backend 48/48, Frontend 34/34 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-11-barcode-qr-lookup`
- **Son Adım:** `Food.barcode` kullanıcı izolasyonlu migration, hız sınırlı ve SSRF korumalı `GET /api/foods/barcode/:code` + soyutlanmış Open Food Facts ilk-sefer önbellekleme, `/api/foods` barkod desteği ve `/nutrition` içi kamera (`BarcodeDetector` + `@zxing/browser`) / elle okuma + tek tıkla ekleme / özel besin tanımlama akışı tamamlandı.

## Sırada Ne Var?
1. `AUTH-11-barcode-qr-lookup` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.2.0` etiketini oluşturmak.
2. `main` üzerinden `AUTH-12` dalını açıp `v1.3.0` — Esnek Antrenman, Şablonlar, Kardiyo & Adım adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
