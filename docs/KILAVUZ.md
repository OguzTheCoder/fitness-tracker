# Uygulama Kılavuzu ve Plan

> **Kurallar:** Uygulamanın nasıl çalıştığını, kapsam sınırını ve yol haritasını özetler; kısa ve tekrar içermeyen biçimde tutulur. Bir karar değişince önce [KARARLAR.md](./KARARLAR.md), sonra bu dosya güncellenir.
> Güncel durum: [ILERLEME.md](./ILERLEME.md) · Tamamlananlar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) · Hatalar: [HATALAR.md](./HATALAR.md) · İndirmeler: [INDIRMELER.md](./INDIRMELER.md)

## 1. Kapsam Sınırı
- **v1.0.0 (`AUTH-1`..`AUTH-11` — Tamamlandı):** Kayıt, giriş, şifre sıfırlama, günlük kilo, manuel kalori, temel antrenman ve 7/30/90 gün özet/SVG grafik MVP'si.
- **v2.0.0 Hedefi (`v1.0.1`..`v2.0.0` — Jira `AUTH-8`+):**
  - **Platform & Erişim:** 0 TL Model B (ücretsiz PostgreSQL + ücretsiz HTTPS host), PC + telefon 7/24 senkron PWA, tam offline çalışma + online olunca otomatik Last-Write-Wins senkron. Kodda mevcut Auth/kayıt korunur; varsayılan yerel açılışta yalnızca isim istenir, canlıda tek ayarla kişisel PIN kilidi açılır.
  - **Beslenme & Tarifler:** Çekirdek temel besin dataset'i + kullanıcı besinleri + tarifler (porsiyon/gram/malzeme ayrıştırma; geçmiş günler snapshot ile kilitli); esnek mikro besin deposu (varsayılan 6 mineral: Na, K, Mg, Ca, Fe, Zn; kullanıcı ayarlarından açılıp kapatılabilir); gram bazlı kalori/makro hedefleri (varsayılan `2000 kcal · 150P/200K/65Y`), opsiyonel öğün etiketi; barkod/QR tarama + Open Food Facts önbellekleme + özel kod tanımlama.
  - **Antrenman, Kardiyo & Vücut:** Kas bölgeli hazır egzersiz dataset'i + serbest hareket ve program şablonu + set × tekrar × ağırlık + önceki antrenman hatırlatması; kardiyo (tür, süre, opsiyonel mesafe & yakılan kalori — yeme hedefinden bağımsız); günlük adım (varsayılan `8.000` hedef) ve günlük kilo.
  - **Veri Sahipliği:** Tek dosya JSON yedekleme/içe aktarma (`merge` / `overwrite`) + CSV dışa aktarma.
- **Kapsam Dışı:** Hedef kilo, bel/yağ oranı gibi ek vücut ölçümleri, ücretli besin API'leri, giyilebilir cihaz entegrasyonu, sosyal özellikler, admin/çoklu rol, çoklu dil, native mobil mağaza derlemesi.

## 2. Mimari ve Klasör Şablonu
- **Frontend (`frontend/`):** React + Vite + TypeScript + Tailwind CSS (Türkçe PWA, IndexedDB offline depo + senkron kuyruğu; yeni tasarım en sona bırakılır)
- **Backend (`backend/`):** Node.js + Express + TypeScript + Zod + JWT + `bcryptjs` + güvenlik katmanı (`helmet`, rate limit)
- **Veritabanı:** Prisma ORM (v1'de SQLite; v2'de 0 TL bulut PostgreSQL + yerelde/testte uyumlu yapı)
- **Testler:** Vitest + Supertest ve Vitest + React Testing Library

```text
Fitness Tracker/
├── .gitignore            # AGENTS.md, docs/INDIRMELER.md, .env, *.db, *.pem/*.key hariç
├── docs/                 # Takip dokümanları (+ yerel docs/GUVENLIK.md)
├── backend/              # prisma/, src/{config,middlewares,modules,utils,app.ts,server.ts}, tests/
└── frontend/             # src/{components,context,pages,services,utils,App.tsx}, tests/
```

## 3. API Özeti
- **v1.0.0 (`AUTH-4`..`AUTH-11`):** `/api/auth/*`, `/api/weights`, `/api/calories`, `/api/workouts`, `/api/stats/summary`
- **v1.0.1..v2.0.0 (Eklenecek / Genişletilecek Modüller):**
  - **Profil & Erişim (`1.0.2`):** `/api/profile` (isim, hedefler, görünür mineraller) · ortam tabanlı PIN kilidi
  - **Beslenme & Tarif (`1.1.0`):** `/api/foods` · `/api/recipes` · `/api/nutrition/logs` (snapshot'lı günlük kayıt + makro/mikro özet)
  - **Barkod / QR (`1.2.0`):** `/api/foods/barcode/:code` (önce yerel DB, yoksa Open Food Facts + özel tanımlama)
  - **Antrenman, Kardiyo & Adım (`1.3.0`):** `/api/exercises` · `/api/workout-templates` · `/api/workouts` (set/tekrar/kg + son performans) · `/api/cardio` · `/api/steps` · güncel `/api/stats/summary`
  - **Yedekleme (`1.4.0`):** `/api/backup/export` (JSON/CSV) · `/api/backup/import` (`merge` | `overwrite`)
  - **Senkronizasyon (`1.5.0`):** `/api/sync` (delta çekme/gönderme + Last-Write-Wins)

## 4. Yol Haritası (SemVer: `v1.0.0` → `v2.0.0`)
**v1.0.0 — Faz 0, Faz 1 & Faz 2 MVP (Tamamlandı)**
- [x] Jira (`AUTH`), Public GitHub repo, `GitHub for Jira`
- [x] `AUTH-1`..`AUTH-7` Kimlik doğrulama, şifre sıfırlama ve entegrasyon testleri
- [x] `AUTH-8`..`AUTH-11` Günlük kilo, manuel kalori, antrenman, istatistik paneli ve Faz 2 testleri

**v1.0.1..v2.0.0 — Aşamalı SemVer Geliştirme (`main` + görev branch'i + Smart Commit + Git Tag)**
- [x] **`v1.0.1` (`AUTH-8`) Güvenlik Sertleştirmesi & Hijyen:** `GUVENLIK.md` açıkları (`helmet`, rate limit, `tokenVersion`, JWT algoritma/secret, JSON/sayfalama sınırı, prod mail kilidi, `.gitignore` desenleri) + testler.
- [ ] **`v1.0.2` (`AUTH-9`) Kişisel Profil & Ortam Tabanlı PIN Kilidi:** Mevcut Auth kodlarını koruyarak profil/hedef/görünür mineral ayarları, varsayılan isimle başlangıç ve canlıda tek ayarla PIN kilidi.
- [ ] **`v1.1.0` (`AUTH-10`) Beslenme Çekirdeği & Tarifler:** Temiz v2 beslenme şeması, temel besin dataset'i seed'i, kullanıcı besin/tarif CRUD'u, snapshot'lı günlük öğün kaydı (opsiyonel etiket) ve esnek mikro besin özetleri.
- [ ] **`v1.2.0` (`AUTH-11`) Barkod / QR & Önbellekli Ürün Arama:** `barcode` alanı, ücretsiz Open Food Facts ilk-sefer sorgusu, kişisel DB önbellekleme ve sistemde olmayan kodu besine tanımlama.
- [ ] **`v1.3.0` (`AUTH-12`) Esnek Antrenman, Şablonlar, Kardiyo & Adım:** Kas bölgeli hazır egzersiz dataset'i, serbest egzersiz/program şablonları, set × tekrar × ağırlık + önceki antrenman hatırlatması, kardiyo ve günlük adım API'leri + güncel özet.
- [ ] **`v1.4.0` (`AUTH-13`) Yedekleme & İçe Aktarma:** Tek dosya JSON tam yedek, doğrulamalı JSON geri yükleme (`merge` / `overwrite`) ve CSV dışa aktarma.
- [ ] **`v1.5.0` (`AUTH-14`) Offline-First Senkron & 0 TL Model B Altyapısı:** PostgreSQL uyumu, delta/Last-Write-Wins `/api/sync`, istemci IndexedDB + offline kuyruk motoru, PWA altyapısı ve 0 TL bulut kurulum ayarları.
- [ ] **`v2.0.0` (`AUTH-15`+) Yeni Nesil Frontend Tasarımı & Canlı Yayın:** Tasarım çalışması sonrası PC + mobil PWA arayüzünün (barkod/QR tarayıcı dahil) yenilenmesi, uçtan uca testler ve `v2.0.0` canlı yayını.

## 5. Çalıştırma
- **Backend kurulum & migration:** `npm install --prefix backend` · `npm --prefix backend run prisma:migrate` · `npm --prefix backend run prisma:generate`
- **Backend geliştirme & derleme:** `npm --prefix backend run dev` · `npm --prefix backend run typecheck` · `npm --prefix backend run build`
- **Frontend kurulum & derleme:** `npm install --prefix frontend` · `npm --prefix frontend run dev` · `npm --prefix frontend run build`
- **Entegrasyon testleri:** `npm --prefix backend run test` · `npm --prefix frontend run test`
