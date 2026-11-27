# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz / Sürüm:** `v2.0.1` (`AUTH-16` — Yüksek Öncelikli Güvenlik Sertleştirmesi: `G-012`..`G-015`) kodlama ve tam doğrulama tamamlandı (Backend 68/68, Frontend 46/46 test, `prisma:pg:validate`, `typecheck` ve her iki `build` 0 hatayla geçti).
- **Aktif Branch:** `AUTH-16-security-hardening-v201`
- **Son Adım:** `production` ortamında boş `APP_PIN` / şablon `JWT_SECRET` fail-fast reddi, canlıda `/api/access/local-session` kilidi (yerelde hız sınırlı), `ALLOW_PUBLIC_AUTH` ile PIN modunda klasik auth kilidi + `personal@local.fitness` koruması + JSON yanıtından ham `token` temizliği, canlı 8+ karakter güçlü `APP_PIN` politikası, IP'den bağımsız `pinGlobalLimiter`, `AccessAttemptState` DB lockout/backoff migration'ı ve `2.0.1` sürüm/SW (`ft-shell-v2.0.1`) senkronizasyonu tamamlandı.

## Sırada Ne Var?
1. `AUTH-16-security-hardening-v201` dalını Smart Commit ile gönderip GitHub Web PR üzerinden `main`'e merge etmek ve `v2.0.1` etiketini oluşturmak.
2. 0 TL Model B (ücretsiz PostgreSQL + ücretsiz HTTPS host) canlı yayını öncesinde (isteğe bağlı) kalan orta/düşük güvenlik maddelerini değerlendirmek ve PC + mobil PWA kurulum/senkron doğrulamasını yapmak.

## Ayrıntı Nerede?
- Plan ve SemVer yol haritası: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
