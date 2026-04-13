# Instagram Reels Control Panel

Dahili operasyon ekipleri için geliştirilmiş **tam yığın web uygulaması**. Kullanıcılar günlük Instagram Reels linklerini girer, yöneticiler bu girişleri takip edip onaylar.

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Uygulamayı Çalıştırma](#uygulamayı-çalıştırma)
- [Test Hesapları](#test-hesapları)
- [Admin 2FA Kurulumu](#admin-2fa-kurulumu)
- [Frontend Sayfaları](#frontend-sayfaları)
- [API Referansı](#api-referansı)
- [Geliştirme Komutları](#geliştirme-komutları)
- [Güvenlik](#güvenlik)
- [Üretim Dağıtımı](#üretim-dağıtımı)

---

## Genel Bakış

İki kullanıcı rolü bulunmaktadır:

| Rol | Yetkiler |
|-----|----------|
| **Admin** | Kullanıcı ve Instagram hesabı yönetimi, günlük rapor onaylama/reddetme/eksik işaretleme, gecikme ve toplu giriş tespiti, cüzdan değişikliği izleme, denetim logu, CSV/Excel dışa aktarma |
| **Kullanıcı** | Günlük Reels link girişi, rapor geçmişi görüntüleme, USDT TRC20 cüzdan adresi yönetimi |

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Monorepo** | pnpm workspaces |
| **Dil** | TypeScript 5.9 · Node.js 24 |
| **Backend** | Express 5 |
| **Veritabanı** | PostgreSQL 14+ · Drizzle ORM |
| **Doğrulama** | Zod · drizzle-zod |
| **API Codegen** | Orval (OpenAPI → TanStack Query hooks + Zod) |
| **Build** | esbuild |
| **Frontend** | React 19 · Vite 7 · TailwindCSS 4 · shadcn/ui |
| **State / Veri** | TanStack Query v5 |
| **Grafikler** | Recharts |
| **Kimlik Doğrulama** | JWT — HttpOnly cookie (localStorage kullanılmaz) |
| **Admin 2FA** | speakeasy (TOTP) · Google Authenticator uyumlu |
| **Güvenlik** | Helmet · CORS kısıtlama · Rate limiting · Brute-force koruması |

---

## Proje Yapısı

```
.
├── artifacts/
│   ├── api-server/              # Express API backend (port 8080)
│   │   └── src/
│   │       ├── routes/          # auth, 2fa, users, reports, export, …
│   │       ├── middlewares/     # auth.ts, rate-limit.ts
│   │       ├── lib/             # Audit log, logger (pino)
│   │       └── index.ts         # Sunucu giriş noktası
│   └── reels-panel/             # React frontend
│       └── src/
│           ├── pages/
│           │   ├── admin/       # Dashboard, review, users, accounts, audit, …
│           │   └── user/        # Dashboard, entry, history, cekim
│           ├── components/      # Ortak UI bileşenleri
│           └── hooks/           # use-auth.tsx
├── lib/
│   ├── db/                      # Drizzle ORM şeması + veritabanı istemcisi
│   ├── api-spec/                # OpenAPI 3.0 spesifikasyonu + Orval yapılandırması
│   ├── api-zod/                 # Orval tarafından üretilen Zod şemaları
│   └── api-client-react/        # Orval tarafından üretilen TanStack Query hook'ları
├── .env.example                 # Tüm ortam değişkenlerinin belgelenmiş şablonu
├── pnpm-workspace.yaml          # Workspace + katalog bağımlılıkları
└── tsconfig.json                # TypeScript proje referansları
```

---

## Veritabanı Şeması

8 tablo:

```
users
├── id, name, username, password_hash
├── role: "admin" | "user"
├── status: "active" | "inactive"
├── personnel_no (300–2000, benzersiz)
├── two_factor_enabled, two_factor_secret
└── two_factor_setup_completed_at, two_factor_last_verified_at

instagram_accounts
├── id, user_id → users
├── instagram_username, profile_url, description
└── status: "active" | "inactive"

daily_reports
├── id, user_id → users, date (yyyy-MM-dd)
├── status: "draft" | "submitted" | "approved" | "rejected" | "late" | "missing" | "bulk_flagged"
├── admin_note, submitted_at, approved_at
└── created_at, updated_at

report_items
├── id, report_id → daily_reports
├── instagram_account_id → instagram_accounts
├── reels_url (normalize edilmiş)
├── content_date, entered_at
└── created_at

wallet_addresses      — Kullanıcı başına bir aktif TRC20 adresi
wallet_address_logs   — Cüzdan değişiklik geçmişi
delay_flags           — Gecikme ve toplu giriş bayrakları
audit_logs            — Tüm kritik sistem aksiyonlarının logu
```

---

## Kurulum

### Gereksinimler

| Araç | Minimum Versiyon |
|------|-----------------|
| Node.js | 22 (önerilen: 24) |
| pnpm | 10 |
| PostgreSQL | 14 |

### 1. Depoyu Klonla

```bash
git clone https://github.com/KULLANICI/instagram-reels-panel.git
cd instagram-reels-panel
```

### 2. Bağımlılıkları Yükle

```bash
pnpm install
```

### 3. Ortam Değişkenlerini Ayarla

```bash
cp .env.example artifacts/api-server/.env
```

`.env` dosyasını açıp aşağıdaki değerleri düzenle:

```env
DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/reels_panel
SESSION_SECRET=<openssl rand -hex 32 ile üretilen 64 karakterlik değer>
```

> **Kritik:** `SESSION_SECRET` eksikse veya 32 karakterden kısaysa sunucu başlamayı reddeder.  
> Güvenli değer üretmek için: `openssl rand -hex 32`

### 4. Veritabanı Tablolarını Oluştur

```bash
pnpm --filter @workspace/db run push
```

Bu komut tüm tabloları (users, instagram_accounts, daily_reports, …) veritabanında oluşturur.

### 5. Başlangıç Verilerini Yükle (Test Hesapları)

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run seed
```

Başarılı çalışırsa şu çıktıyı görürsün:

```
Seed complete. Admin: admin/admin123, Users: ahmet,mehmet,ayse/password123
```

---

## Ortam Değişkenleri

### API Sunucusu — `artifacts/api-server/.env`

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` | Evet | PostgreSQL bağlantı URL'si |
| `SESSION_SECRET` | Evet | JWT imzalama anahtarı, min. 32 karakter |
| `PORT` | Hayır | API port (varsayılan: 8080) |
| `NODE_ENV` | Hayır | `development` veya `production` |
| `CORS_ORIGIN` | Üretimde Evet | Frontend URL'si (ör. `https://app.replit.app`) |

### Frontend — `artifacts/reels-panel/.env`

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `VITE_API_BASE_URL` | Hayır | API adresi (varsayılan: `/api`) |

Tüm değişkenlerin açıklaması `.env.example` dosyasında yer almaktadır.

---

## Uygulamayı Çalıştırma

**İki ayrı terminal** aç:

**Terminal 1 — API Sunucusu:**
```bash
pnpm --filter @workspace/api-server run dev
```
→ `http://localhost:8080` adresinde başlar.

**Terminal 2 — Frontend:**
```bash
pnpm --filter @workspace/reels-panel run dev
```
→ `http://localhost:5173` adresinde başlar.

---

## Test Hesapları

Seed komutu çalıştırıldıktan sonra hazır gelir:

| Kullanıcı Adı | Şifre | Rol | Not |
|---------------|-------|-----|-----|
| `admin` | `admin123` | Admin | İlk girişte 2FA kurulumu zorunlu |
| `ahmet` | `password123` | Kullanıcı | 2 Instagram hesabı atanmış |
| `mehmet` | `password123` | Kullanıcı | — |
| `ayse` | `password123` | Kullanıcı | — |

> **Üretimde:** `admin123` şifresini admin panelinden (`/admin/users`) mutlaka değiştirin.

---

## Admin 2FA Kurulumu

Admin hesapları **Google Authenticator (TOTP)** gerektirir. 2FA olmadan admin paneline erişilemez.

### İlk Giriş — 2FA Kurulumu

```
1. admin / <şifre> ile giriş yap
2. Sistem otomatik olarak 2FA Kurulum sayfasına yönlendirir
3. Telefonunda Google Authenticator'ı aç → "+" → "QR kodu tara"
4. Ekrandaki QR kodu tara
5. Uygulamadaki 6 haneli kodu forma gir → "Doğrula"
6. Admin paneline yönlendirilirsin
```

> **QR kod tarayamazsan:** Sayfada gösterilen manuel kodu Google Authenticator'a "Kurulum anahtarını gir" seçeneğiyle ekleyebilirsin.

### Sonraki Girişler

```
1. admin / <şifre> ile giriş yap
2. Sistem 2FA Doğrulama sayfasına yönlendirir
3. Google Authenticator'dan 6 haneli kodu gir
4. Admin paneline yönlendirilirsin
```

| Güvenlik Detayı | Değer |
|----------------|-------|
| Pre-auth token süresi | 5 dakika |
| 2FA deneme limiti | 5 hatalı deneme → 15 dakika blok |
| TOTP tolerans | ±30 saniye (window: 1) |

---

## Frontend Sayfaları

### Admin Paneli

| Sayfa | URL | Açıklama |
|-------|-----|----------|
| Dashboard | `/admin/dashboard` | İstatistik kartları + 14 günlük aktivite grafiği |
| İnceleme | `/admin/review` | Günlük raporları onayla / reddet / eksik işaretle |
| Kullanıcılar | `/admin/users` | Kullanıcı oluşturma, düzenleme, durum ve şifre yönetimi |
| Hesaplar | `/admin/accounts` | Instagram hesabı oluşturma ve kullanıcıya atama |
| İzleme | `/admin/monitoring` | Gecikme ve toplu giriş tespiti |
| Cüzdanlar | `/admin/wallets` | USDT TRC20 cüzdan değişiklik izleme |
| Denetim Logu | `/admin/audit` | Tüm sistem aksiyonları |
| Dışa Aktar | `/admin/export` | CSV veya Excel olarak günlük rapor indir |
| 2FA Kurulum | `/admin/2fa-setup` | İlk girişte otomatik yönlendirilen kurulum sayfası |
| 2FA Doğrulama | `/admin/2fa-verify` | Sonraki girişlerde TOTP kodu doğrulama |

### Kullanıcı Paneli

| Sayfa | URL | Açıklama |
|-------|-----|----------|
| Ana Sayfa | `/dashboard` | Bugünkü rapor durumu, eksik günler, atanan hesaplar |
| Günlük Giriş | `/entry` | Tarih seçerek Reels linki ekle / sil |
| Geçmiş | `/history` | Geçmiş raporlar ve admin notları |
| Çekim | `/cekim` | USDT TRC20 cüzdan adresi ekleme ve değiştirme |

---

## API Referansı

Tüm endpoint'ler `/api` prefix'i ile başlar. Kimlik doğrulama `auth_token` **HttpOnly cookie** üzerinden yapılır.

### Kimlik Doğrulama

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/auth/login` | Giriş yap |
| `POST` | `/api/auth/logout` | Çıkış yap |
| `GET` | `/api/auth/me` | Aktif kullanıcı bilgisi |
| `POST` | `/api/auth/2fa/setup` | Admin 2FA QR kodu üret |
| `POST` | `/api/auth/2fa/verify-setup` | İlk 2FA kurulumunu tamamla |
| `POST` | `/api/auth/2fa/verify` | Giriş akışında 2FA kodunu doğrula |

### Raporlar ve Reeller

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/daily-reports` | Raporları listele |
| `POST` | `/api/daily-reports` | Rapor oluştur veya mevcut olanı getir |
| `GET` | `/api/daily-reports/:id` | Rapor detayı |
| `PATCH` | `/api/daily-reports/:id` | Rapor durumunu güncelle |
| `POST` | `/api/report-items` | Rapora reel linki ekle |
| `DELETE` | `/api/report-items/:id` | Reel linkini sil |

### Kullanıcılar ve Hesaplar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/users` | Kullanıcı listesi |
| `POST` | `/api/users` | Kullanıcı oluştur |
| `GET` | `/api/users/:id` | Kullanıcı detayı + davranış özeti |
| `PATCH` | `/api/users/:id` | Kullanıcı güncelle |
| `POST` | `/api/users/:id/reset-password` | Şifre sıfırla |
| `GET` | `/api/instagram-accounts` | Hesap listesi |
| `POST` | `/api/instagram-accounts` | Hesap oluştur |
| `PATCH` | `/api/instagram-accounts/:id` | Hesap güncelle |

### Dashboard ve Diğer

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/dashboard/summary` | Admin genel istatistikler |
| `GET` | `/api/dashboard/user-summary` | Kullanıcı kişisel özet |
| `GET` | `/api/dashboard/daily-activity` | 14 günlük aktivite verisi |
| `GET` | `/api/export/daily-report?date=&format=csv\|xlsx` | Rapor dışa aktarma |
| `GET` | `/api/audit-logs` | Denetim logu |
| `GET` | `/api/delay-flags` | Gecikme bayrakları |
| `GET/POST/PATCH` | `/api/wallet-addresses` | Cüzdan adresi yönetimi |
| `GET` | `/api/healthz` | Sağlık kontrolü |

---

## Geliştirme Komutları

```bash
# Tüm paketlerde TypeScript tip kontrolü
pnpm run typecheck

# API sunucusunu build et
pnpm --filter @workspace/api-server run build

# Veritabanı şemasını uygula (geliştirme)
pnpm --filter @workspace/db run push

# OpenAPI spec'ten Zod şemalarını ve React Query hook'larını yeniden üret
pnpm --filter @workspace/api-spec run codegen
cd lib/api-client-react && pnpm exec tsc -p tsconfig.json
```

> **Önemli:** `lib/api-spec/` içindeki OpenAPI spec'te değişiklik yaptıktan sonra codegen komutunu mutlaka tekrar çalıştır.

---

## Doğrulama Kuralları

| Alan | Kural |
|------|-------|
| **Reels URL** | Yalnızca `https://www.instagram.com/reel/{id}/` formatı; kısaltıcılar reddedilir |
| **TRC20 Cüzdan** | `T` ile başlar, tam 34 karakter, base58 karakter seti |
| **Personel Numarası** | 300–2000 arası tam sayı, sistemde benzersiz |
| **Şifre** | Minimum 8 karakter |
| **Geç Teslim** | Rapor tarihinden 2 günden fazla geçmişse `late` durumu |
| **Toplu Giriş Bayrağı** | 5 günden fazla gecikme tespit edilirse `bulk_flagged` |

---

## Güvenlik

| Özellik | Detay |
|---------|-------|
| **Oturum** | HttpOnly + Secure + SameSite=Lax cookie; localStorage kullanılmaz |
| **Token süresi** | 4 saat |
| **Admin 2FA** | Google Authenticator (TOTP); zorunlu, bypass edilemez |
| **Session Secret** | Minimum 32 karakter; eksikse sunucu başlamaz |
| **Brute-force koruması** | IP+kullanıcı adı başına 10 başarısız giriş → 15 dakika kilit |
| **Rate limiting** | Login: 10/dk · Wallet: 5/saat · 2FA: 5/15dk · Global (prod): 200/dk |
| **HTTP başlıkları** | Helmet.js (CSP, HSTS, X-Frame-Options, nosniff) |
| **CORS** | Sadece güvenilir origin'ler (`*.replit.app` veya `CORS_ORIGIN` env) |
| **Body limit** | 100 KB |
| **Timing attack** | Kullanıcı varlığı tespitine karşı sabit süreli bcrypt karşılaştırması |
| **Denetim logu** | Tüm kritik aksiyonlar `audit_logs` tablosuna yazılır |

---

## Üretim Dağıtımı (VPS)

> Üretimde backend **hem API'yi hem de frontend'i tek portta** servis eder. Ayrı bir Nginx / statik sunucu gerekmez.

### 1. `.env` Dosyasını Oluştur

```bash
cp .env.example .env
```

`.env` içini doldurun:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/reels_panel
SESSION_SECRET=<openssl rand -hex 32 ile üretilmiş 64 karakter>
PORT=3000
NODE_ENV=production
# LOG_LEVEL=info
```

### 2. Build Al (tek komut)

```bash
pnpm run build:prod
```

Bu komut şunları sırasıyla yapar:
1. `pnpm install` — bağımlılıkları yükler
2. Backend build → `artifacts/api-server/dist/`
3. Frontend build (`BASE_PATH=/`, `VITE_API_BASE_URL=/api`) → `artifacts/reels-panel/dist/public/`
4. Frontend dosyalarını `artifacts/api-server/dist/public/` altına kopyalar

### 3. Veritabanı Şemasını Uygula ve Başlat

```bash
pnpm run start:prod
```

Bu komut `.env` dosyasını okur, `drizzle-kit push` ile şemayı uygular ve sunucuyu başlatır.

Ya da manuel:

```bash
# Şema push
pnpm run db:push

# Başlat
NODE_ENV=production PORT=3000 node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### 4. Sağlık Kontrolü

```bash
curl http://localhost:3000/api/healthz
# {"status":"ok"}
```

### PM2 ile Daemonize (Önerilen)

```bash
npm install -g pm2
pm2 start artifacts/api-server/dist/index.mjs \
  --name reels-panel \
  --node-args "--enable-source-maps" \
  --env production
pm2 save
pm2 startup
```

### Nginx Ters Proxy (İsteğe Bağlı, Önerilen)

```nginx
server {
    listen 80;
    server_name sizin-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Lisans

MIT
