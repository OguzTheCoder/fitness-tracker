# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.0.2` (`AUTH-9` — Kişisel Profil, Ortam Tabanlı PIN Kilidi & `G-005` `HttpOnly` Çerez Oturumu) kodlama ve doğrulama tamamlandı (Backend 39/39, Frontend 29/29 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-9-profile-pin-session`
- **Son Adım:** `UserProfile` şeması + `/api/profile` (hedefler + görünür mineraller), `/api/access/*` (yerel isim / `APP_PIN` kilidi + rate-limit + `tokenVersion`), `/api/auth/logout*`, `G-005` `HttpOnly` kalıcı çerez oturumu ve `/access` + `/profile` arayüzleri tamamlandı.

## Sırada Ne Var?
1. `AUTH-9-profile-pin-session` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.0.2` etiketini oluşturmak.
2. `main` üzerinden `AUTH-10` dalını açıp `v1.1.0` — Beslenme Çekirdeği & Tarifler adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
