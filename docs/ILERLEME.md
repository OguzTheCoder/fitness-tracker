# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v2.0.0` (`AUTH-15` — Yeni Nesil PC + Mobil PWA Frontend Tasarımı) kodlama ve doğrulama tamamlandı (Backend 64/64, Frontend 46/46 test ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-15-v2-frontend-redesign`
- **Son Adım:** Çift tema (`ThemeContext`), PC Sol Menü (`Sidebar`) + Mobil PWA Alt Menü (`Bottom Bar`), Bento özet + `ProgressRing` + etkileşimli/hedef çizgili `TrendChart`, `SlideOver` çekmeceler (Hızlı Kilo/Adım, Kilo, Beslenme canlı arama `Combobox`, Barkod/QR, Antrenman), minimalist standart formlar, çevrimdışı `lucide-react` ikonları ve `2.0.0` sürüm/SW (`ft-shell-v2.0.0`) güncellemesi tamamlandı; tüm güvenlik ve offline-first kuralları korundu.

## Sırada Ne Var?
1. `AUTH-15-v2-frontend-redesign` dalını Smart Commit ile gönderip GitHub Web PR üzerinden `main`'e merge etmek ve `v2.0.0` etiketini oluşturmak.
2. 0 TL Model B (ücretsiz PostgreSQL + ücretsiz HTTPS host) canlı yayınını ve PC + mobil PWA kurulum/senkron uçtan uca doğrulamasını yapmak.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
