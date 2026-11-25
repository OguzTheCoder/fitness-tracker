# Tamamlanan Yapılar

> **Kurallar:**
> - Yalnızca **projede tamamlanıp doğrulanan uygulama yapıları/görevleri** (örn. `AUTH-4`, `AUTH-1`) kaydedilir.
> - Doküman oluşturma, planlama veya sohbet içi küçük düzenlemeler buraya **yazılmaz**.
> - Her kayıt tek satırda kısa tutulur; güncel durum ve sıradaki iş [ILERLEME.md](./ILERLEME.md) içindedir.

| Tarih | Görev | Tamamlanan Yapı | Doğrulama |
| :--- | :--- | :--- | :--- |
| 2026-11-25 | `AUTH-4` | `backend/` iskeleti (Express 5 + TS + Zod + JWT + `bcryptjs`), Prisma/SQLite `User` şeması (`init_user`) ve `POST /api/auth/register` + `GET /api/health`. | `tsc` + canlı HTTP testi (200/400/201/409/404) geçti. |
