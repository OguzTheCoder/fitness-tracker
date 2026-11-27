# Kararlar Listesi

> **Kural:** Yalnızca kalıcı mimari, teknik ve kapsam kararları **tek satırda kısa** yazılır. Karar değişince önce bu dosya, sonra [KILAVUZ.md](./KILAVUZ.md) güncellenir; eski karar silinmez, durumu `Değişti` yapılır.

| Kod | Tarih | Konu | Karar | Durum |
| :--- | :--- | :--- | :--- | :--- |
| K-001 | 2026-11-25 | Çalışma Alanı | `C:\Projects\Code` okunmaz/değiştirilmez; tüm çalışma `C:\Projects\Fitness Tracker` içindedir. | Aktif |
| K-002 | 2026-11-25 | Doküman Yapısı | Proje hafızası `docs/` altındaki 6 `.md` dosyasıyla yürütülür. | Aktif |
| K-003 | 2026-11-25 | Ajan & Gizlilik | Oğuz'un kuralları `AGENTS.md`'de tutulur; `AGENTS.md`, `docs/INDIRMELER.md` ve `.env` `.gitignore`'dadır. | Aktif |
| K-004 | 2026-11-25 | Süreç & PR | Tek kişilik geliştirme; her görevde ayrı branch (`AUTH-X-...`), Smart Commit (`AUTH-X ...`), self-review PR ve 5 Kanban sütunu uygulanır. | Aktif |
| K-005 | 2026-11-25 | Teknoloji Yığını | Tek Public repo içinde TypeScript Monorepo: `frontend/` (React+Vite+TS) + `backend/` (Node+Express+TS). | Aktif |
| K-006 | 2026-11-25 | Veritabanı | SQLite + Prisma ORM (sıfır sunucu kurulumu, izole test DB, ileride PostgreSQL'e taşınabilir). | Değişti |
| K-007 | 2026-11-25 | Şifre Sıfırlama | 15 dk süreli, tek kullanımlık hash'lenmiş token + soyutlanmış `MailProvider` (yerelde konsol/test yakalayıcı, ileride SMTP/API). | Aktif |
| K-008 | 2026-11-25 | Auth & Güvenlik | JWT (Bearer Access Token) + `bcryptjs` hash + Zod girdi doğrulama. | Aktif |
| K-009 | 2026-11-25 | Test Kapsamı | `AUTH-7`: Backend API + izole SQLite DB (Vitest + Supertest) ve Frontend form/akış (Vitest + RTL). | Aktif |
| K-010 | 2026-11-25 | Fazlama | Kesin 2 Faz: Önce Faz 1 (`AUTH-1..7`) tamamen `Done` (teslim hazır), sonra Faz 2 Fitness MVP (`AUTH-8+`). | Değişti |
| K-011 | 2026-11-25 | Faz 2 Kapsamı | **Dahil:** Kilo, manuel kalori, antrenman kaydı, basit istatistik paneli. **Hariç:** Dış yemek API, giyilebilir, admin, sosyal, makro/hedef, çoklu dil, mobil. | Değişti |
| K-012 | 2026-11-25 | Arayüz & Stil | Türkçe arayüz + Tailwind CSS. | Aktif |
| K-013 | 2026-11-25 | Doküman Sadeliği | Tüm `docs/*.md` dosyaları kısa, tekrar içermeyen ve tablo/madde odaklı tutulur; `TAMAMLANANLAR.md`'ye yalnızca tamamlanan uygulama yapıları yazılır. | Aktif |
| K-014 | 2026-11-25 | Faz 2 Arayüz & Grafik | Ortak üst menülü (`AppLayout`) ayrı sayfalar (`/dashboard`, `/weights`, `/calories`, `/workouts`) ve sıfır bağımlılıklı responsive SVG trend grafiği. | Değişti |
| K-015 | 2026-11-25 | Faz 2 Veri & API | Tarihler `YYYY-MM-DD` (opsiyonel `from`/`to` filtreli); kiloda aynı güne upsert (`@@unique([userId, date])`); kaloride serbest öğün + günlük toplam; antrenmanda tarih/ad/süre/not; panelde 7/30/90 gün özet + kilo/kalori trendi. | Aktif |
| K-016 | 2026-11-26 | Sürümleme & Dal (`v2`) | Mevcut MVP `v1.0.0` etiketlenir; `main` üzerinden küçük görev branch'leri (Jira `AUTH-8+`), Smart Commit ve SemVer (`1.0.x` patch, `1.x.0` minor → `2.0.0` major) uygulanır. | Aktif |
| K-017 | 2026-11-26 | Barındırma & Platform | 0 TL hedefli Model B (ücretsiz yönetilen PostgreSQL + ücretsiz HTTPS host, Prisma ORM) + PWA ile PC ve telefon 7/24 senkron çalışır. | Aktif |
| K-018 | 2026-11-26 | Giriş & Kişisel Kilit | Mevcut Auth/kayıt kodları korunur; varsayılan yerel açılışta yalnızca isim istenir, canlıda tek ortam ayarıyla kişisel PIN kilidi (cihazda kalıcı oturum) açılır. | Aktif |
| K-019 | 2026-11-26 | Besin & Mikro Besinler | Çekirdek temel besin dataset'i + kullanıcı besin/tarif kütüphanesi; tüm temel vitamin/mineraller esnek yapıda saklanır, varsayılan 6 mineral (Na, K, Mg, Ca, Fe, Zn) görünür ve kullanıcı ayarlarından açılıp kapatılabilir. | Aktif |
| K-020 | 2026-11-26 | Tarifler & Öğün Hedefi | Tarifler porsiyon, gram veya malzeme ayrıştırmayla eklenir ve geçmiş günler kayıt anındaki değerle kilitlenir (snapshot); hedef kilo yoktur, kalori/makro hedefleri gram bazlıdır (varsayılan 2000 kcal · 150P/200K/65Y), öğün etiketi opsiyoneldir. | Aktif |
| K-021 | 2026-11-26 | Barkod / QR | Kamera ile barkod/QR okuma + ücretsiz Open Food Facts ilk-sefer sorgusu (kişisel DB'ye önbellekleme); sistemde olmayan kodlar kullanıcının kendi besinine tanımlanabilir. | Aktif |
| K-022 | 2026-11-26 | Antrenman, Kardiyo & Adım | Kas bölgeli hazır egzersiz dataset'i + serbest hareket/program şablonu + set/tekrar/ağırlık + önceki antrenman hatırlatması; kardiyo (tür/süre/opsiyonel mesafe & kalori, yeme hedefinden bağımsız) + günlük adım (varsayılan 8.000 hedef) + yalnızca kilo takibi. | Aktif |
| K-023 | 2026-11-26 | Offline & Senkron | İstemcide IndexedDB ile tam offline okuma/yazma/düzenleme/silme; online olunca otomatik arka plan senkronizasyonu ve en son değişiklik geçerli (Last-Write-Wins) kuralı uygulanır. | Aktif |
| K-024 | 2026-11-26 | Yedekleme & İçe Aktarma | Tüm veriler tek JSON dosyasıyla yedeklenir (içe aktarmada birleştir veya üzerine yaz seçenekleri) ve tablo inceleme için CSV dışa aktarma sunulur. | Aktif |
| K-025 | 2026-11-26 | v2 Geliştirme Sırası | Yerelde korunacak v1 verisi olmadığından temiz v2 şeması kurulur; önce güvenlik, veri modeli, backend API, sync ve 0 TL altyapı tamamlanır, yeni Frontend tasarımı en sona (`v2.0.0`) bırakılır. | Aktif |
| K-026 | 2026-11-27 | v2.0.0 Frontend Tasarımı | Çift tema (varsayılan modern koyu + tek tıkla açık tema), PC'de sol menü (`Sidebar`) + mobilde alt menü (`Bottom Bar`), Bento özet + SVG `ProgressRing` & etkileşimli `TrendChart`, açılır çekmece (`SlideOver` Bottom Sheet/Drawer) + canlı besin arama, minimalist standart formlar ve çevrimdışı `lucide-react` ikonları. | Aktif |
