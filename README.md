# eBay Web Scraping API (JavaScript + Playwright + AI)

Scrape listing eBay berdasarkan kata kunci, **ikut pagination** otomatis, ambil **title, price, dan description** (dari halaman detail). **AI (DeepSeek/OpenAI compatible)** dipakai untuk mengekstrak deskripsi ketika struktur halaman tidak stabil. Output **JSON**. Field kosong -> `"-"`.

> ⚠️ Catatan etika: gunakan di lingkungan test/interview. Perhatikan robots.txt dan ToS situs. Rate-limit sudah dipasang ringan + headless browser untuk kestabilan.

## Fitur
- ✅ JavaScript (Node 18+), Express API
- ✅ Playwright headless browser (lebih stabil untuk situs dinamis)
- ✅ AI-assisted description extraction (DeepSeek **plus point**, OpenAI sebagai alternatif)
- ✅ Pagination sampai habis (dengan pagar `HARD_MAX_PAGES`)
- ✅ Concurrency terbatas (default 3) + jeda acak (ramah anti-bot)
- ✅ Output JSON rapi, fallback `"-"` untuk missing fields

## Setup
```bash
git clone <repo-anda>
cd ebay-scrape-api
cp .env.example .env
# edit .env -> isi DEEPSEEK_API_KEY atau OPENAI_API_KEY
npm install
npx playwright install chromium
```

## Jalankan API
```bash
npm start
# http://localhost:3000/health
# http://localhost:3000/scrape?query=nike
# opsi: &max_pages=3&use_ai=true&headless=true
```

### Contoh cURL
```bash
curl "http://localhost:3000/scrape?query=nike&max_pages=2&use_ai=true"
```

#### Contoh respons (dipotong):
```json
{
  "query": "nike",
  "total": 92,
  "items": [
    {
      "page": 1,
      "position": 1,
      "url": "https://www.ebay.com/itm/XXXXXXXX",
      "title": "Nike Air Max ...",
      "price": "$89.99",
      "description": "Kondisi baru, material mesh ..."
    }
  ]
}
```

## Jalankan Tes Cepat (tanpa server)
```bash
# query, max_pages, use_ai, headless
npm run scrape "nike" 1 true true
```

## Konfigurasi AI
- **DeepSeek** (disarankan sesuai soal)
  - Set pada `.env`:
    ```
    LLM_PROVIDER=deepseek
    DEEPSEEK_API_KEY=sk-...
    DEEPSEEK_BASE_URL=https://api.deepseek.com
    DEEPSEEK_MODEL=deepseek-chat
    ```
- **OpenAI** (opsional)
  - Set:
    ```
    LLM_PROVIDER=openai
    OPENAI_API_KEY=sk-...
    OPENAI_BASE_URL=https://api.openai.com/v1
    OPENAI_MODEL=gpt-4o-mini
    ```

> Implementasi `llm.js` menggunakan endpoint **OpenAI-compatible** `/chat/completions` sehingga gampang ditukar provider.

## Kustomisasi
- Batasi halaman maksimum lewat query string `max_pages` atau `.env` `HARD_MAX_PAGES`.
- Ubah concurrency via `.env` `MAX_CONCURRENCY`.
- Tambah selector baru untuk deskripsi di `extractDescriptionFromDetail()` jika ada layout eBay yang berbeda.

## Known Notes
- eBay kadang memuat deskripsi di tab/iframe domain berbeda. Kode sudah mencoba berbagai selector + fallback AI berdasarkan `innerText` halaman. Kalau masih kosong, AI akan mengembalikan `"-"`.
- Jika mendapat blokir rate-limit, kecilkan `MAX_CONCURRENCY` dan tambah sleep.

## Submission
1. Push proyek ini ke repo GitHub publik.
2. Sertakan link repo dalam email jawaban.
3. Pastikan README ini + instruksi sudah lengkap.
