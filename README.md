[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/SherlockFP/Code0)
# 🎯 AGENT0 - Profesyonel Multiplayer Kelime Oyunu

<div align="center">

![AGENT0 Logo](https://img.shields.io/badge/AGENT0-Codenames-blue?style=for-the-badge&logo=target)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7+-black?style=flat-square&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Takım tabanlı strateji oyunu** • **Gerçek zamanlı multiplayer** • **Güçlü kart sistemi**

[🎮 Demo](https://agent0-game.example.com) • [📖 Dokümantasyon](#özellikler) • [🐛 Sorun Bildir](https://github.com/SherlockFP/Code0/issues)

</div>

---

## 📋 İçindekiler

- [Hakkında](#-hakkında)
- [Özellikler](#-özellikler)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [Oynanış](#-oynanış)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

---

## 🎮 Hakkında

**AGENT0**, klasik Codenames oyununun profesyonel bir multiplayer uyarlamasıdır. İki takım halinde yarışın, casusbaşınızın verdiği ipuçlarıyla doğru kelimeleri bulun ve rakiplerinizi geride bırakın!

### Neden AGENT0?

- ⚡ **Gerçek Zamanlı**: Socket.IO ile anlık senkronizasyon
- 🎨 **Kişiselleştirilebilir**: Dark mode, tema renkleri, arka plan seçenekleri
- 🃏 **Güçlü Kart Sistemi**: 25+ farklı power card ile strateji geliştirin
- 🏆 **Turnuva Modu**: Rekabetçi oyun deneyimi
- 💬 **Takım İçi Sohbet**: Takım arkadaşlarınızla stratejik iletişim
- 📱 **Responsive**: Mobil ve masaüstü uyumlu

---

## ✨ Özellikler

### Oyun Modları
- 🎯 **Normal Mod**: Klasik Codenames deneyimi
- 🏆 **Tournament Mod**: Power card'lar kapalı, rekabetçi oyun
- 🧩 **Draft Modu**: Pick & Ban sistemi ile takım stratejisi

### Kişiselleştirme
- 🌘 **Dark/Light Mode**: Göz dostu tema seçenekleri
- 🎨 **Özel Arka Planlar**: Renk seçici ile kişiselleştirme
- 🔋 **Power Save Mode**: Düşük performanslı cihazlar için optimizasyon
- 🎵 **Ses Kontrolleri**: Müzik ve efekt ayarları

### Sosyal Özellikler
- 💬 **Takım Sohbeti**: Takım içi stratejik iletişim
- 😀 **Emoji Reaksiyonlar**: Hızlı duygusal tepkiler
- 🎁 **Özel Efektler**: Slash komutları ile eğlenceli animasyonlar
- 📢 **Korna Sistemi**: Takım arkadaşlarınızı uyarın

### Teknik Özellikler
- 🚀 **GPU Hızlandırma**: Akıcı animasyonlar
- 📊 **Performans İzleme**: Real-time optimizasyon
- 🔒 **Güvenli Bağlantı**: Socket.IO ile şifreli iletişim
- 💾 **Otomatik Kayıt**: LocalStorage ile ayarları hatırlama

---

## 🚀 Kurulum

### Gereksinimler

- Node.js 18.x veya üzeri
- npm veya yarn paket yöneticisi
- Modern web tarayıcısı (Chrome, Firefox, Safari, Edge)

### Adımlar

1. **Projeyi klonlayın**
```bash
git clone https://github.com/SherlockFP/Code0.git
cd Code0
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Sunucuyu başlatın**
```bash
node server.js
```

4. **Tarayıcıda açın**
```
http://localhost:3000
```

### Alternatif Port
```bash
PORT=8080 node server.js
```

---

## 🎯 Kullanım

### 1. Giriş Yapın
- Kullanıcı adınızı girin (max 15 karakter)
- "Oyuna Başla" butonuna tıklayın

### 2. Oda Oluşturun veya Katılın
- **Yeni Oda**: Oda adı, kelime seti ve oyuncu sayısı seçin
- **Mevcut Oda**: Aktif odalardan birine katılın
- **Davet Kodu**: 6 haneli kod ile doğrudan katılın

### 3. Takım Seçin
- 🔴 **Kırmızı Takım** veya 🔵 **Mavi Takım**
- 🎩 **Casusbaşı** veya 👤 **Operatif** rolü seçin

### 4. Oyuna Başlayın
- En az 4 oyuncu (her takımda 1 casusbaşı + 1 operatif)
- "OYUNU BAŞLAT" butonuna tıklayın

---

## 🎲 Oynanış

### Roller

#### 🎩 Casusbaşı
- Tüm kartların renklerini görebilir
- Takımına **tek kelimelik ipucu** ve **sayı** verir
- Örnek: "Hayvan 3" → 3 hayvan kartı açılmalı

#### 👤 Operatif
- Casusbaşının ipucuna göre **doğru kartları** açmaya çalışır
- Yanlış açarsa sıra geçer veya oyun biter

### Kart Türleri

| Renk | Açıklama | Sonuç |
|------|----------|-------|
| 🔴 Kırmızı | Kırmızı takımın kartı | +1 puan |
| 🔵 Mavi | Mavi takımın kartı | +1 puan |
| 🟡 Nötr | Tarafsız kart | Sıra geçer |
| ⚫ Suikastçı | Kaybetme kartı | Oyun biter! |

### Power Cards (Güç Kartları)

25+ farklı power card ile stratejinizi güçlendirin:

- **🔍 Double Clue**: Aynı turda 2 ipucu verin
- 🎯 **Reveal**: Rakip kartını açığa çıkarın
- 🔄 **Swap**: 2 kartın yerini değiştirin
- 🛡️ **Shield**: Kartı koruyun
- ⏳ **Extra Time**: Ekstra hamle hakkı
- ve daha fazlası...

### Slash Komutları

Özel efektler için chat'e yazın:

- `/yagmur` - Yağmur efekti
- `/zeus` - Yıldırım efekti
- `/fire` - Ateş efekti
- `/snow` - Kar efekti
- `/water` - Su efekti
- `/quake` - Deprem efekti

### Chat Komutları

- **Normal mesaj**: Herkese açık
- `/p mesaj` - Sadece takımınıza özel mesaj

---

## 🎨 Kişiselleştirme

### Dark Mode
- Sağ üst köşede ☀️/🌙 butonuna tıklayın
- Otomatik olarak kaydedilir

### Arka Plan Rengi
- 🎨 Renk seçici ile istediğiniz rengi seçin
- 🌈 Varsayılan gökkuşağı arka plana dönmek için butona tıklayın

### Power Save Mode
- 🔋 Düşük performanslı cihazlarda etkinleştirin
- Animasyonlar ve efektler azaltılır

---

## 🛠️ Teknolojiler

### Frontend
- **HTML5** - Semantik yapı
- **CSS3** - Modern stil ve animasyonlar
- **Vanilla JavaScript** - ES6+ özellikleri
- **Socket.IO Client** - Gerçek zamanlı iletişim

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **Socket.IO** - WebSocket kütüphanesi

### Özellikler
- **GPU Acceleration** - transform3d, will-change
- **Passive Event Listeners** - Scroll performansı
- **CSS Containment** - Render optimizasyonu
- **LocalStorage** - Ayarları kaydetme

---

## 📱 Tarayıcı Desteği

| Tarayıcı | Versiyon |
|----------|----------|
| Chrome | 90+ ✅ |
| Firefox | 88+ ✅ |
| Safari | 14+ ✅ |
| Edge | 90+ ✅ |
| Opera | 76+ ✅ |

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! İşte nasıl katkıda bulunabilirsiniz:

1. **Fork** edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. **Pull Request** açın

### Geliştirme Kuralları
- Kod standartlarına uyun (ES6+)
- Yorum satırları ekleyin
- Değişikliklerinizi test edin
- Commit mesajlarını açıklayıcı yazın

---

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

- **Proje Linki**: [https://github.com/SherlockFP/Code0](https://github.com/SherlockFP/Code0)
- **Issues**: [https://github.com/SherlockFP/Code0/issues](https://github.com/SherlockFP/Code0/issues)

---

## 🙏 Teşekkürler

- [Socket.IO](https://socket.io/) - Gerçek zamanlı iletişim
- [Node.js](https://nodejs.org/) - Server runtime
- Tüm katkıda bulunanlara ❤️

---

<div align="center">

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!**

Made with ❤️ by [SherlockFP](https://github.com/SherlockFP)

</div>
