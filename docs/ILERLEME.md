# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v1.0.1` (`AUTH-8` — Güvenlik Sertleştirmesi & Hijyen) kodlama ve doğrulama tamamlandı (Backend 34/34, Frontend 24/24 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-8-security-hardening`
- **Son Adım:** `G-001`..`G-004`, `G-006`..`G-011` ve `R-003` güvenlik açıkları kapatıldı; güvenlik testleri ve dokümanlar güncellendi (`G-005` planlandığı gibi `v1.0.2` / `AUTH-9` adımına bırakıldı).

## Sırada Ne Var?
1. `AUTH-8-security-hardening` dalını Smart Commit ile gönderip PR üzerinden `main`'e merge etmek ve `v1.0.1` etiketini oluşturmak.
2. `main` üzerinden `AUTH-9` dalını açıp `v1.0.2` — Kişisel Profil, Kalıcı Çerez Oturumu (`G-005`) & Ortam Tabanlı PIN Kilidi adımına geçmek.
3. *(Paralel/isteğe bağlı)* `v2.0.0` Frontend fazı için görsel tasarım tercihlerini biriktirmeye devam etmek.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
