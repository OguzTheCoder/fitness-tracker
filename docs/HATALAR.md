# Hatalar ve Çözümleri

> **Kurallar:**
> - Yalnızca karşılaşılan gerçek teknik hatalar ve kalıcı çözüm yolu yazılır.
> - Her kayıt tek satırda kısa tutulur; uzun hata çıktısı/log yapıştırılmaz.

| Tarih | Hata / Sorun | Çözüm Yolu | Durum |
| :--- | :--- | :--- | :--- |
| 2026-11-25 | Node 26 deneysel `localStorage` getter'ının Vitest + `jsdom` ortamında `undefined` dönerek `localStorage`'ı gölgelemesi | `frontend/tests/setup.ts` içinde standart Web `Storage` uyumlu bellek içi `localStorage` fallback'i tanımlandı. | Çözüldü |
