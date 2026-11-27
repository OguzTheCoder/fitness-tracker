# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v2.0.1` (`AUTH-16` — Üretim Ortamı ve Erişim Sertleştirmesi) `main` dalına merge edildi ve doğrulandı (Backend 68/68, Frontend 46/46 test, `prisma:pg:validate`, `typecheck` ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-16-docs-security-hygiene`
- **Son Adım:** Üretim ortamı başlangıç doğrulaması (`APP_PIN` ve `JWT_SECRET`), erişim hız sınırı + kalıcı lockout (`AccessAttemptState`), PIN modunda klasik auth bayrağı (`ALLOW_PUBLIC_AUTH`), `HttpOnly` çerez oturum temizliği ve `2.0.1` sürüm/SW (`ft-shell-v2.0.1`) senkronizasyonu tamamlandı; public doküman ve test metinlerindeki iç takip kodları nötr dile geçirildi.

## Sırada Ne Var?
1. `AUTH-16-docs-security-hygiene` dalını Smart Commit ile gönderip `main`'e merge etmek.
2. 0 TL Model B (ücretsiz PostgreSQL + ücretsiz HTTPS host) canlı yayınını ve PC + mobil PWA kurulum/senkron uçtan uca doğrulamasını yapmak.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
