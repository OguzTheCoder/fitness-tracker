# İlerleme Durumu

> **Kurallar:** Projenin giriş noktasıdır; **her adımdan sonra güncellenir**. Yalnızca güncel durum ve sıradaki 1–3 adım tutulur; eski işler burada biriktirilmez (biten yapılar [TAMAMLANANLAR.md](./TAMAMLANANLAR.md) içine gider).

## Neredeyiz?
- **Faz:** Faz 1 — Authentication (`AUTH-4` kodlama ve doğrulama tamamlandı)
- **Aktif Branch:** `AUTH-4-backend-iskelet-register`
- **Son Adım:** `backend/` iskeleti (Express 5 + TS + Zod + JWT + `bcryptjs`), Prisma/SQLite `User` şeması (`init_user` migration) ve `POST /api/auth/register` + `GET /api/health` uç noktaları kuruldu; 5 HTTP senaryosu (200/400/201/409/404) ve `tsc` derlemesi doğrulandı.

## Sırada Ne Var?
1. `AUTH-4` değişikliklerini Smart Commit (`AUTH-4 ...`) ile commit edip `origin`'e push etmek ve PR açmak (`Code Review` → `Testing` → `Done`).
2. `main` dalına dönüp `AUTH-5-backend-login-me` branch'ini açmak (Jira `AUTH-5` → `In Progress`).
3. `POST /api/auth/login` ve `GET /api/auth/me` (JWT doğrulama middleware'i dahil) uç noktalarını yazıp doğrulamak.

## Ayrıntı Nerede?
- Plan ve mimari şablon: [KILAVUZ.md](./KILAVUZ.md)
- Kararlar: [KARARLAR.md](./KARARLAR.md)
- Tamamlanan yapılar: [TAMAMLANANLAR.md](./TAMAMLANANLAR.md)
- Hatalar: [HATALAR.md](./HATALAR.md)
- İndirmeler: [INDIRMELER.md](./INDIRMELER.md)
