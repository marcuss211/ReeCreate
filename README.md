# Instagram Reels Control Panel

Dahili operasyon ekipleri için tasarlanmış, kullanıcıların günlük Instagram Reels linklerini girmesine ve yöneticilerin bu girişleri onaylamasına olanak tanıyan **tam yığın (full-stack) web uygulaması**.

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Geliştirme](#geliştirme)
- [API Referansı](#api-referansı)
- [Frontend Sayfaları](#frontend-sayfaları)
- [Test Hesapları](#test-hesapları)
- [Kod Üretimi (Codegen)](#kod-üretimi-codegen)
- [Dağıtım](#dağıtım)

---

## Genel Bakış

Bu uygulama iki rol üzerine kuruludur:

| Rol | Yetki |
|-----|-------|
| **Admin** | Kullanıcı yönetimi, Instagram hesabı atama, günlük rapor onaylama/reddetme, gecikme takibi, cüzdan değişikliği izleme, dışa aktarma |
| **Kullanıcı** | Günlük Reels linki girişi, geçmiş raporları görüntüleme, USDT TRC20 cüzdan adresi yönetimi |

---

## Özellikler

### Kullanıcı Tarafı
- Günlük Reels link girişi (tarih bazlı, onaydan sonra da yeni link eklenebilir)
- Her link için eklenme tarihi ve saati gösterimi
- Rapor durumu takibi: Taslak → Onay Bekliyor → Onaylandı / Reddedildi
- Geçmiş rapor görüntüleme
- USDT TRC20 cüzdan adresi ekleme ve değiştirme

### Admin Tarafı
- Günlük rapor onaylama / reddetme / eksik işaretleme
- Kullanıcı ve Instagram hesabı CRUD işlemleri
- Gecikme ve toplu giriş tespiti
- Cüzdan adresi değişiklik izleme (güvenlik)
- Tam denetim logu (audit log)
- CSV / Excel dışa aktarma
- 14 günlük aktivite grafiği

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Monorepo** | pnpm workspaces |
| **Dil** | TypeScript 5.9, Node.js 24 |
| **Backend** | Express 5 |
| **Veritabanı** | PostgreSQL + Drizzle ORM |
| **Doğrulama** | Zod v4, drizzle-zod |
| **API Codegen** | Orval (OpenAPI → TanStack Query hooks + Zod) |
| **Build** | esbuild |
| **Frontend** | React 19, Vite 7, TailwindCSS 4, shadcn/ui |
| **State / Veri** | TanStack Query v5 |
| **Grafikler** | Recharts |
| **Kimlik Doğrulama** | JWT (Bearer token, localStorage) |

---

## Proje Yapısı

```
.
├── artifacts/
│   ├── api-server/          # Express API backend (port 8080)
│   │   ├── src/
│   │   │   ├── routes/      # Tüm API route'ları
│   │   │   ├── middlewares/ # Auth middleware
│   │   │   ├── lib/         # Audit log yardımcısı
│   │   │   └── index.ts     # Sunucu giriş noktası
│   │   └── build.mjs        # esbuild yapılandırması
│   └── reels-panel/         # React frontend
│       └── src/
│           ├── pages/
│           │   ├── admin/   # Admin sayfaları
│           │   └── user/    # Kullanıcı sayfaları
│           ├── components/  # Ortak UI bileşenleri
│           └── hooks/       # React hook'ları
├── lib/
│   ├── db/                  # Drizzle ORM şeması + veritabanı istemcisi
│   ├── api-spec/            # OpenAPI spesifikasyonu + Orval yapılandırması
│   ├── api-zod/             # Orval tarafından üretilen Zod şemaları
│   └── api-client-react/    # Orval tarafından üretilen TanStack Query hook'ları
├── scripts/                 # Yardımcı script'ler
├── pnpm-workspace.yaml      # Workspace + katalog bağımlılıkları
└── tsconfig.json            # TypeScript proje referansları
```

---

## Veritabanı Şeması

8 tablo bulunmaktadır:

```
users
├── id, name, username, password_hash
├── role: "admin" | "user"
├── status: "active" | "inactive"
└── personnel_no (300–2000 arası, benzersiz)

instagram_accounts
├── id, user_id (FK → users)
├── instagram_username, profile_url, description
└── status: "active" | "inactive"

daily_reports
├── id, user_id (FK → users), date (yyyy-MM-dd)
├── status: "draft" | "submitted" | "approved" | "rejected" | "late" | "missing" | "bulk_flagged"
├── admin_note, submitted_at, approved_at
└── created_at, updated_at

report_items
├── id, report_id (FK → daily_reports)
├── instagram_account_id (FK → instagram_accounts)
├── reels_url (normalize edilmiş: https://www.instagram.com/reel/{id}/)
├── content_date, entered_at
└── created_at

wallet_addresses
├── id, user_id (FK → users, UNIQUE)
├── network: "TRC20", wallet_address
└── status: "active" | "replaced" | "flagged"

wallet_address_logs    # Cüzdan değişiklik geçmişi
delay_flags            # Gecikme ve toplu giriş bayrakları
audit_logs             # Tüm sistem aksiyonlarının logu
```

---

## Kurulum

### Gereksinimler

- **Node.js** >= 22 (önerilen: 24)
- **pnpm** >= 10
- **PostgreSQL** >= 14

### 1. Depoyu Klonla

```bash
git clone https://github.com/kullanici/instagram-reels-panel.git
cd instagram-reels-panel
```

### 2. Bağımlılıkları Yükle

```bash
pnpm install
```

### 3. Ortam Değişkenlerini Ayarla

Proje kökünde `.env` dosyası oluştur (bkz. [Ortam Değişkenleri](#ortam-değişkenleri)):

```bash
cp .env.example .env
# .env dosyasını kendi değerlerinle düzenle
```

### 4. Veritabanı Şemasını Oluştur

```bash
pnpm --filter @workspace/db run push
```

### 5. Veritabanını Seed Et (Test Verileri)

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run seed
```

Bu komut aşağıdaki test hesaplarını oluşturur:

| Kullanıcı Adı | Şifre | Rol |
|---------------|-------|-----|
| `admin` | `admin123` | Admin |
| `ahmet` | `password123` | Kullanıcı |
| `mehmet` | `password123` | Kullanıcı |
| `ayse` | `password123` | Kullanıcı |

### 6. Uygulamayı Başlat

**İki ayrı terminal** açarak:

**Terminal 1 — API Sunucusu:**
```bash
pnpm --filter @workspace/api-server run dev
```
API sunucusu `http://localhost:8080` adresinde çalışır.

**Terminal 2 — Frontend:**
```bash
pnpm --filter @workspace/reels-panel run dev
```
Frontend `http://localhost:5173` (veya `$PORT`) adresinde çalışır.

---

## Ortam Değişkenleri

### API Sunucusu (`artifacts/api-server/.env`)

```env
# Zorunlu
DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/reels_panel
JWT_SECRET=gizli-jwt-anahtari-buraya-yaz

# İsteğe Bağlı
PORT=8080
NODE_ENV=development
```

### Frontend (`artifacts/reels-panel/.env`)

```env
# API sunucusunun adresi
VITE_API_BASE_URL=http://localhost:8080
```

> **Not:** `DATABASE_URL` bağlantı dizesi standart PostgreSQL formatındadır.  
> Örnek: `postgresql://postgres:password@localhost:5432/mydb`

---

## Geliştirme

### Tüm Paketlerde Tip Kontrolü

```bash
pnpm run typecheck
```

### API Sunucusu Build

```bash
pnpm --filter @workspace/api-server run build
```

### Veritabanı Şeması Değişikliklerini Uygula

```bash
# Geliştirme ortamında (force push)
pnpm --filter @workspace/db run push

# Force (onay istemeden)
pnpm --filter @workspace/db run push-force
```

---

## API Referansı

Tüm endpoint'ler `/api` prefix'i ile başlar. JWT token'ı `Authorization: Bearer <token>` header'ı ile gönderilir.

### Kimlik Doğrulama

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/auth/login` | Giriş yap, JWT döner |
| `POST` | `/api/auth/logout` | Çıkış yap |
| `GET` | `/api/auth/me` | Mevcut kullanıcı bilgileri |

### Günlük Raporlar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/daily-reports` | Raporları listele (tarih, kullanıcı, durum filtresi) |
| `POST` | `/api/daily-reports` | Rapor oluştur veya mevcut olanı döndür (idempotent) |
| `GET` | `/api/daily-reports/:id` | Rapor detayı (item'larla birlikte) |
| `PATCH` | `/api/daily-reports/:id` | Durum güncelle (submitted/approved/rejected/missing) |

### Reel Kalemleri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/report-items` | Rapora reel linki ekle |
| `DELETE` | `/api/report-items/:id` | Reel linkini sil |

> **Not:** Onaylı veya gönderilmiş raporlara yeni link eklenebilir. Ekleme işlemi raporu otomatik olarak tekrar "submitted" durumuna alır.

### Dashboard

| Method | Endpoint | Rol | Açıklama |
|--------|----------|-----|----------|
| `GET` | `/api/dashboard/summary` | Admin | Genel istatistikler |
| `GET` | `/api/dashboard/user-summary` | Kullanıcı | Kişisel özet (hesaplar, onaylı reel sayısı, bugünkü durum) |
| `GET` | `/api/dashboard/daily-activity` | Admin | 14 günlük aktivite verisi |

### Kullanıcılar ve Hesaplar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/users` | Kullanıcı listesi |
| `POST` | `/api/users` | Kullanıcı oluştur |
| `PATCH` | `/api/users/:id` | Kullanıcı güncelle |
| `GET` | `/api/instagram-accounts` | Hesap listesi |
| `POST` | `/api/instagram-accounts` | Hesap oluştur |
| `PATCH` | `/api/instagram-accounts/:id` | Hesap güncelle |

### Diğer

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/export/daily-report?date=&format=csv\|xlsx` | Rapor dışa aktarma |
| `GET` | `/api/audit-logs` | Denetim logu |
| `GET` | `/api/delay-flags` | Gecikme bayrakları |
| `GET` | `/api/delay-flags/behavior-summary` | Kullanıcı bazlı davranış özeti |
| `GET/POST/PATCH` | `/api/wallet-addresses` | Cüzdan adresi yönetimi |
| `GET` | `/api/health` | Sağlık kontrolü |

---

## Frontend Sayfaları

### Admin

| Sayfa | Yol | Açıklama |
|-------|-----|----------|
| Dashboard | `/admin/dashboard` | İstatistik kartları + 14 günlük aktivite grafiği |
| İnceleme | `/admin/review` | Günlük raporları onayla / reddet / eksik işaretle |
| Kullanıcılar | `/admin/users` | Kullanıcı oluşturma, düzenleme, durum ve şifre yönetimi |
| Hesaplar | `/admin/accounts` | Instagram hesabı oluşturma ve kullanıcıya atama |
| İzleme | `/admin/monitoring` | Gecikme ve toplu giriş tespiti |
| Cüzdanlar | `/admin/wallets` | USDT TRC20 cüzdan değişiklik izleme |
| Denetim Logu | `/admin/audit` | Tüm sistem aksiyonları |
| Dışa Aktar | `/admin/export` | CSV / Excel olarak rapor indir |

### Kullanıcı

| Sayfa | Yol | Açıklama |
|-------|-----|----------|
| Ana Sayfa | `/dashboard` | Bugünkü durum, eksik günler, atanan hesaplar (onaylı reel sayısıyla) |
| Günlük Giriş | `/entry` | Tarih seçip Reels linki ekleme / silme |
| Geçmiş | `/history` | Geçmiş raporlar ve admin notları |
| Çekim | `/cekim` | USDT TRC20 cüzdan adresi yönetimi |

---

## Test Hesapları

Seed komutu çalıştırıldıktan sonra:

| Kullanıcı Adı | Şifre | Rol | Notlar |
|---------------|-------|-----|--------|
| `admin` | `admin123` | Admin | Tüm admin yetkilerine sahip |
| `ahmet` | `password123` | Kullanıcı | 2 Instagram hesabı atanmış |
| `mehmet` | `password123` | Kullanıcı | — |
| `ayse` | `password123` | Kullanıcı | — |

---

## Kod Üretimi (Codegen)

API şeması `lib/api-spec` içindeki OpenAPI spec dosyasından türetilir. Orval bu spec'i okuyarak TypeScript hook'ları ve Zod şemalarını otomatik üretir.

### API Hook'larını ve Şemalarını Yeniden Üret

```bash
# 1. OpenAPI spec'ten Zod + React Query hook'larını üret
pnpm --filter @workspace/api-spec run codegen

# 2. api-client-react için tip tanımlarını yeniden derle
cd lib/api-client-react && pnpm exec tsc -p tsconfig.json
```

> **Önemli:** OpenAPI spec'te değişiklik yaptıktan sonra bu adımları mutlaka tekrarlayın.

---

## Doğrulama Kuralları

| Alan | Kural |
|------|-------|
| **Reels URL** | `instagram.com/reel/{id}/` formatına normalize edilir |
| **TRC20 Cüzdan** | `/^T[1-9A-HJ-NP-Za-km-z]{33}$/` regex kontrolü |
| **Personel No** | 300–2000 arası tam sayı, benzersiz |
| **Gecikme Bayrağı** | Rapor tarihinden 2 günden fazla geçmişse `late` durumu |
| **Toplu Giriş Bayrağı** | 5 günden fazla gecikme tespit edilirse `bulk_flagged` |

---

## Dağıtım

### Üretim Build

```bash
# API sunucusunu derle
pnpm --filter @workspace/api-server run build

# Frontend'i derle
pnpm --filter @workspace/reels-panel run build
```

### Ortam Değişkenleri (Üretim)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=guclu-rastgele-bir-deger
PORT=8080
```

### Çalıştırma

```bash
# API sunucusu
node --enable-source-maps artifacts/api-server/dist/index.mjs

# Frontend (statik dosyalar)
# dist/ klasörünü Nginx veya herhangi bir statik sunucu ile servis edin
```

---

## Güvenlik Notları

- JWT secret'ı güçlü ve rastgele bir değer olarak ayarlayın (min. 32 karakter önerilir)
- Üretimde `admin123` varsayılan şifresini mutlaka değiştirin
- `pnpm-workspace.yaml` içindeki `minimumReleaseAge: 1440` ayarı tedarik zinciri saldırılarına karşı koruma sağlar — devre dışı bırakmayın
- Tüm durum geçişleri `audit_logs` tablosuna kaydedilir
- Cüzdan adresi değişiklikleri `wallet_address_logs` tablosunda tarihçesiyle saklanır

---

## Lisans

MIT
