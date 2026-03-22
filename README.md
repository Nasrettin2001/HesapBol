# 💰 HesapBöl

**HesapBöl**, arkadaş grupları, ev arkadaşları veya seyahat ortakları arasında masrafları kolayca bölüştürmeye yarayan bir mobil uygulamadır. Kimin kime ne kadar borçlu olduğunu takip eder ve hesaplaşmayı basitleştirir.

> 🇹🇷 Türkçe arayüzlü, modern ve kullanımı kolay bir masraf paylaşım uygulaması.

---

## ✨ Özellikler

- 👥 **Grup Yönetimi** — Sevgili, Ev, Gezi kategorilerinde gruplar oluşturun ve arkadaşlarınızı davet edin
- 💸 **Masraf Takibi** — Harcamaları ekleyin, grup üyeleri arasında otomatik bölüştürün
- 📊 **Bakiye Hesaplama** — Toplam alacak, borç ve net bakiyenizi anlık görün
- 🔗 **Davet Linki** — Tek tıkla gruba katılma
- 🎨 **Koyu / Açık / Sistem Teması** — Üç farklı tema desteği
- 👤 **Profil & Avatar** — Profil fotoğrafı yükleme ve düzenleme
- 📱 **iOS & Android** — Her iki platformda çalışır

---

## 🛠 Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Framework** | [Expo](https://expo.dev) (SDK 54) + React Native |
| **Yönlendirme** | [Expo Router](https://docs.expo.dev/router/introduction/) |
| **Stil** | [NativeWind](https://www.nativewind.dev/) v4 (TailwindCSS) |
| **Backend** | [Supabase](https://supabase.com) (PostgreSQL, Auth, Storage) |
| **Dil** | TypeScript |

---

## 📁 Proje Yapısı

```
HesapBol/
├── app/
│   ├── (auth)/login.tsx          # Giriş ekranı
│   ├── (tabs)/                   # Ana sekmeler
│   │   ├── index.tsx             # Gruplar & bakiye özeti
│   │   ├── activity.tsx          # Aktivite akışı
│   │   └── account.tsx           # Profil & ayarlar
│   ├── group/                    # Grup işlemleri
│   │   ├── [id].tsx              # Grup detayı
│   │   ├── new.tsx               # Yeni grup
│   │   ├── invite.tsx            # Üye davet
│   │   ├── join.tsx              # Gruba katılma
│   │   └── members.tsx           # Üye yönetimi
│   └── expense/                  # Harcama işlemleri
│       ├── new.tsx               # Yeni harcama
│       └── edit.tsx              # Harcama düzenleme
├── providers/                    # Auth & Tema sağlayıcıları
├── lib/supabase.ts               # Supabase bağlantısı
└── supabase/schema.sql           # Veritabanı şeması
```

---

## 🗃 Veritabanı

```
users ──── group_members ──── groups
  │                             │
  └──── expenses ──── expense_splits
```

Tüm tablolar **Row Level Security (RLS)** ile korunmaktadır.

---

## 🚀 Kurulum

```bash
# 1. Klonlayın
git clone https://github.com/Nasrettin2001/HesapBol.git
cd HesapBol/HesapBol

# 2. Bağımlılıkları yükleyin
npm install

# 3. .env dosyası oluşturun
# EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 4. Veritabanını kurun (Supabase SQL Editor'de schema.sql çalıştırın)

# 5. Başlatın
npx expo start
```

---

## 📄 Lisans

Bu proje açık kaynaklıdır. Kişisel ve eğitim amaçlı kullanabilirsiniz.

## 👤 Geliştirici

**Nasrettin** — [@Nasrettin2001](https://github.com/Nasrettin2001)
