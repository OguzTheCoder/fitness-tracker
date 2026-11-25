# Kararlar Listesi

> **Kural:** Yalnızca kalıcı mimari, teknik ve kapsam kararları **tek satırda kısa** yazılır. Karar değişince önce bu dosya, sonra [KILAVUZ.md](./KILAVUZ.md) güncellenir; eski karar silinmez, durumu `Değişti` yapılır.

| Kod | Tarih | Konu | Karar | Durum |
| :--- | :--- | :--- | :--- | :--- |
| K-001 | 2026-11-25 | Çalışma Alanı | `C:\Projects\Code` okunmaz/değiştirilmez; tüm çalışma `C:\Projects\Fitness Tracker` içindedir. | Aktif |
| K-002 | 2026-11-25 | Doküman Yapısı | Proje hafızası `docs/` altındaki 6 `.md` dosyasıyla yürütülür. | Aktif |
| K-003 | 2026-11-25 | Ajan & Gizlilik | Oğuz'un kuralları `AGENTS.md`'de tutulur; `AGENTS.md`, `docs/INDIRMELER.md` ve `.env` `.gitignore`'dadır. | Aktif |
| K-004 | 2026-11-25 | Süreç & PR | Tek kişilik geliştirme; her görevde ayrı branch (`AUTH-X-...`), Smart Commit (`AUTH-X ...`), self-review PR ve 5 Kanban sütunu uygulanır. | Aktif |
| K-005 | 2026-11-25 | Teknoloji Yığını | Tek Public repo içinde TypeScript Monorepo: `frontend/` (React+Vite+TS) + `backend/` (Node+Express+TS). | Aktif |
| K-006 | 2026-11-25 | Veritabanı | SQLite + Prisma ORM (sıfır sunucu kurulumu, izole test DB, ileride PostgreSQL'e taşınabilir). | Aktif |
| K-007 | 2026-11-25 | Şifre Sıfırlama | 15 dk süreli, tek kullanımlık hash'lenmiş token + soyutlanmış `MailProvider` (yerelde konsol/test yakalayıcı, ileride SMTP/API). | Aktif |
| K-008 | 2026-11-25 | Auth & Güvenlik | JWT (Bearer Access Token) + `bcryptjs` hash + Zod girdi doğrulama. | Aktif |
| K-009 | 2026-11-25 | Test Kapsamı | `AUTH-7`: Backend API + izole SQLite DB (Vitest + Supertest) ve Frontend form/akış (Vitest + RTL). | Aktif |
| K-010 | 2026-11-25 | Fazlama | Kesin 2 Faz: Önce Faz 1 (`AUTH-1..7`) tamamen `Done` (teslim hazır), sonra Faz 2 Fitness MVP (`AUTH-8+`). | Aktif |
| K-011 | 2026-11-25 | Faz 2 Kapsamı | **Dahil:** Kilo, manuel kalori, antrenman kaydı, basit istatistik paneli. **Hariç:** Dış yemek API, giyilebilir, admin, sosyal, makro/hedef, çoklu dil, mobil. | Aktif |
| K-012 | 2026-11-25 | Arayüz & Stil | Türkçe arayüz + Tailwind CSS. | Aktif |
| K-013 | 2026-11-25 | Doküman Sadeliği | Tüm `docs/*.md` dosyaları kısa, tekrar içermeyen ve tablo/madde odaklı tutulur; `TAMAMLANANLAR.md`'ye yalnızca tamamlanan uygulama yapıları yazılır. | Aktif |
