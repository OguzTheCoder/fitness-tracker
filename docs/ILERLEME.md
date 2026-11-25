# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (`AUTH-4`, `AUTH-5`, `AUTH-6` merge edildi; `AUTH-1` kodlama ve doğrulama tamamlandı)
- **Aktif Branch:** `AUTH-1-frontend-iskelet-register`
- **Son Adım:** `frontend/` iskeleti (React 19 + Vite 6 + TypeScript + Tailwind CSS 3), ortak API/Auth servisi (`api.ts`, `authService.ts`), yeniden kullanılabilir bileşenler (`AuthLayout`, `FormField`) ve Türkçe Kayıt ekranı (`RegisterPage`) eklendi; `tsc -b && vite build` 0 hatayla geçti.

## Sırada Ne Var?
1. `AUTH-1` değişikliklerini Smart Commit (`AUTH-1 ...`) ile commit edip `origin`'e push etmek, PR açıp merge etmek.
2. `AUTH-2-frontend-login-session` branch'ini açıp `AuthContext` (JWT oturum yönetimi + `/api/auth/me` doğrulama + `ProtectedRoute`), `LoginPage` ve oturum açılmış ana paneli eklemek.
3. Ardından `AUTH-3` (Şifre Sıfırlama ekranları) ve `AUTH-7` (Backend + Frontend Entegrasyon Testleri) ile Faz 1'i bitirmek.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
