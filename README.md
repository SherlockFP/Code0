[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/SherlockFP/Code0)
# ðŸŽ¯ AGENT0 - Profesyonel Multiplayer Kelime Oyunu

<div align="center">

![AGENT0 Logo](https://img.shields.io/badge/AGENT0-Codenames-blue?style=for-the-badge&logo=target)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7+-black?style=flat-square&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**TakÄ±m tabanlÄ± strateji oyunu** â€¢ **GerÃ§ek zamanlÄ± multiplayer** â€¢ **GÃ¼Ã§lÃ¼ kart sistemi**

[ðŸŽ® Demo](https://agent0-game.example.com) â€¢ [ðŸ“– DokÃ¼mantasyon](#Ã¶zellikler) â€¢ [ðŸ› Sorun Bildir](https://github.com/SherlockFP/Code0/issues)

</div>

---

## ðŸ“‹ Ä°Ã§indekiler

- [HakkÄ±nda](#-hakkÄ±nda)
- [Ã–zellikler](#-Ã¶zellikler)
- [Kurulum](#-kurulum)
- [KullanÄ±m](#-kullanÄ±m)
- [OynanÄ±ÅŸ](#-oynanÄ±ÅŸ)
- [KatkÄ±da Bulunma](#-katkÄ±da-bulunma)
- [Lisans](#-lisans)

---

## ðŸŽ® HakkÄ±nda

**AGENT0**, klasik Codenames oyununun profesyonel bir multiplayer uyarlamasÄ±dÄ±r. Ä°ki takÄ±m halinde yarÄ±ÅŸÄ±n, casusbaÅŸÄ±nÄ±zÄ±n verdiÄŸi ipuÃ§larÄ±yla doÄŸru kelimeleri bulun ve rakiplerinizi geride bÄ±rakÄ±n!

### Neden AGENT0?

- âš¡ **GerÃ§ek ZamanlÄ±**: Socket.IO ile anlÄ±k senkronizasyon
- ðŸŽ¨ **KiÅŸiselleÅŸtirilebilir**: Dark mode, tema renkleri, arka plan seÃ§enekleri
- ðŸƒ **GÃ¼Ã§lÃ¼ Kart Sistemi**: 25+ farklÄ± power card ile strateji geliÅŸtirin
- ðŸ† **Turnuva Modu**: RekabetÃ§i oyun deneyimi
- ðŸ’¬ **TakÄ±m Ä°Ã§i Sohbet**: TakÄ±m arkadaÅŸlarÄ±nÄ±zla stratejik iletiÅŸim
- ðŸ“± **Responsive**: Mobil ve masaÃ¼stÃ¼ uyumlu

---

## âœ¨ Ã–zellikler

### Oyun ModlarÄ±
- ðŸŽ¯ **Normal Mod**: Klasik Codenames deneyimi
- ðŸ† **Tournament Mod**: Power card'lar kapalÄ±, rekabetÃ§i oyun
- ðŸ§© **Draft Modu**: Pick & Ban sistemi ile takÄ±m stratejisi

### KiÅŸiselleÅŸtirme
- ðŸŒ“ **Dark/Light Mode**: GÃ¶z dostu tema seÃ§enekleri
- ðŸŽ¨ **Ã–zel Arka Planlar**: Renk seÃ§ici ile kiÅŸiselleÅŸtirme
- ðŸ”‹ **Power Save Mode**: DÃ¼ÅŸÃ¼k performanslÄ± cihazlar iÃ§in optimizasyon
- ðŸŽµ **Ses Kontrolleri**: MÃ¼zik ve efekt ayarlarÄ±

### Sosyal Ã–zellikler
- ðŸ’¬ **TakÄ±m Sohbeti**: TakÄ±m iÃ§i stratejik iletiÅŸim
- ðŸ˜€ **Emoji Reaksiyonlar**: HÄ±zlÄ± duygusal tepkiler
- ðŸŽ **Ã–zel Efektler**: Slash komutlarÄ± ile eÄŸlenceli animasyonlar
- ðŸ“¯ **Korna Sistemi**: TakÄ±m arkadaÅŸlarÄ±nÄ±zÄ± uyarÄ±n

### Teknik Ã–zellikler
- ðŸš€ **GPU HÄ±zlandÄ±rma**: AkÄ±cÄ± animasyonlar
- ðŸ“Š **Performans Ä°zleme**: Real-time optimizasyon
- ðŸ”’ **GÃ¼venli BaÄŸlantÄ±**: Socket.IO ile ÅŸifreli iletiÅŸim
- ðŸ’¾ **Otomatik KayÄ±t**: LocalStorage ile ayarlarÄ± hatÄ±rlama

---

## ðŸš€ Kurulum

### Gereksinimler

- Node.js 18.x veya Ã¼zeri
- npm veya yarn paket yÃ¶neticisi
- Modern web tarayÄ±cÄ±sÄ± (Chrome, Firefox, Safari, Edge)

### AdÄ±mlar

1. **Projeyi klonlayÄ±n**
```bash
git clone https://github.com/SherlockFP/Code0.git
cd Code0
```

2. **BaÄŸÄ±mlÄ±lÄ±klarÄ± yÃ¼kleyin**
```bash
npm install
```

3. **Sunucuyu baÅŸlatÄ±n**
```bash
node server.js
```

4. **TarayÄ±cÄ±da aÃ§Ä±n**
```
http://localhost:3000
```

### Alternatif Port
```bash
PORT=8080 node server.js
```

---

## ðŸŽ¯ KullanÄ±m

### 1. GiriÅŸ YapÄ±n
- KullanÄ±cÄ± adÄ±nÄ±zÄ± girin (max 15 karakter)
- "Oyuna BaÅŸla" butonuna tÄ±klayÄ±n

### 2. Oda OluÅŸturun veya KatÄ±lÄ±n
- **Yeni Oda**: Oda adÄ±, kelime seti ve oyuncu sayÄ±sÄ± seÃ§in
- **Mevcut Oda**: Aktif odalardan birine katÄ±lÄ±n
- **Davet Kodu**: 6 haneli kod ile doÄŸrudan katÄ±lÄ±n

### 3. TakÄ±m SeÃ§in
- ðŸ”´ **KÄ±rmÄ±zÄ± TakÄ±m** veya ðŸ”µ **Mavi TakÄ±m**
- ðŸŽ© **CasusbaÅŸÄ±** veya ðŸ‘¤ **Operatif** rolÃ¼ seÃ§in

### 4. Oyuna BaÅŸlayÄ±n
- En az 4 oyuncu (her takÄ±mda 1 casusbaÅŸÄ± + 1 operatif)
- "OYUNU BAÅžLAT" butonuna tÄ±klayÄ±n

---

## ðŸŽ² OynanÄ±ÅŸ

### Roller

#### ðŸŽ© CasusbaÅŸÄ±
- TÃ¼m kartlarÄ±n renklerini gÃ¶rebilir
- TakÄ±mÄ±na **tek kelimelik ipucu** ve **sayÄ±** verir
- Ã–rnek: "Hayvan 3" â†’ 3 hayvan kartÄ± aÃ§Ä±lmalÄ±

#### ðŸ‘¤ Operatif
- CasusbaÅŸÄ±nÄ±n ipucuna gÃ¶re **doÄŸru kartlarÄ±** aÃ§maya Ã§alÄ±ÅŸÄ±r
- YanlÄ±ÅŸ aÃ§arsa sÄ±ra geÃ§er veya oyun biter

### Kart TÃ¼rleri

| Renk | AÃ§Ä±klama | SonuÃ§ |
|------|----------|-------|
| ðŸ”´ KÄ±rmÄ±zÄ± | KÄ±rmÄ±zÄ± takÄ±mÄ±n kartÄ± | +1 puan |
| ðŸ”µ Mavi | Mavi takÄ±mÄ±n kartÄ± | +1 puan |
| ðŸŸ¡ NÃ¶tr | TarafsÄ±z kart | SÄ±ra geÃ§er |
| âš« SuikastÃ§Ä± | Kaybetme kartÄ± | Oyun biter! |

### Power Cards (GÃ¼Ã§ KartlarÄ±)

25+ farklÄ± power card ile stratejinizi gÃ¼Ã§lendirin:

- **ðŸ” Double Clue**: AynÄ± turda 2 ipucu verin
- **ðŸŽ¯ Reveal**: Rakip kartÄ±nÄ± aÃ§Ä±ÄŸa Ã§Ä±karÄ±n
- **ðŸ”„ Swap**: 2 kartÄ±n yerini deÄŸiÅŸtirin
- **ðŸ›¡ï¸ Shield**: KartÄ± koruyun
- **â° Extra Time**: Ekstra hamle hakkÄ±
- ve daha fazlasÄ±...

### Slash KomutlarÄ±

Ã–zel efektler iÃ§in chat'e yazÄ±n:

- `/yagmur` - YaÄŸmur efekti
- `/zeus` - YÄ±ldÄ±rÄ±m efekti
- `/fire` - AteÅŸ efekti
- `/snow` - Kar efekti
- `/water` - Su efekti
- `/quake` - Deprem efekti

### Chat KomutlarÄ±

- **Normal mesaj**: Herkese aÃ§Ä±k
- `/p mesaj` - Sadece takÄ±mÄ±nÄ±za Ã¶zel mesaj

---

## ðŸŽ¨ KiÅŸiselleÅŸtirme

### Dark Mode
- SaÄŸ Ã¼st kÃ¶ÅŸede â˜€ï¸/ðŸŒ™ butonuna tÄ±klayÄ±n
- Otomatik olarak kaydedilir

### Arka Plan Rengi
- ðŸŽ¨ Renk seÃ§ici ile istediÄŸiniz rengi seÃ§in
- ðŸŒˆ VarsayÄ±lan gÃ¶kkuÅŸaÄŸÄ± arka plana dÃ¶nmek iÃ§in butona tÄ±klayÄ±n

### Power Save Mode
- ðŸ”‹ DÃ¼ÅŸÃ¼k performanslÄ± cihazlarda etkinleÅŸtirin
- Animasyonlar ve efektler azaltÄ±lÄ±r

---

## ðŸ› ï¸ Teknolojiler

### Frontend
- **HTML5** - Semantik yapÄ±
- **CSS3** - Modern stil ve animasyonlar
- **Vanilla JavaScript** - ES6+ Ã¶zellikleri
- **Socket.IO Client** - GerÃ§ek zamanlÄ± iletiÅŸim

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **Socket.IO** - WebSocket kÃ¼tÃ¼phanesi

### Ã–zellikler
- **GPU Acceleration** - transform3d, will-change
- **Passive Event Listeners** - Scroll performansÄ±
- **CSS Containment** - Render optimizasyonu
- **LocalStorage** - AyarlarÄ± kaydetme

---

## ðŸ“± TarayÄ±cÄ± DesteÄŸi

| TarayÄ±cÄ± | Versiyon |
|----------|----------|
| Chrome | 90+ âœ… |
| Firefox | 88+ âœ… |
| Safari | 14+ âœ… |
| Edge | 90+ âœ… |
| Opera | 76+ âœ… |

---

## ðŸ¤ KatkÄ±da Bulunma

KatkÄ±larÄ±nÄ±zÄ± bekliyoruz! Ä°ÅŸte nasÄ±l katkÄ±da bulunabilirsiniz:

1. **Fork** edin
2. Feature branch oluÅŸturun (`git checkout -b feature/AmazingFeature`)
3. DeÄŸiÅŸikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. **Pull Request** aÃ§Ä±n

### GeliÅŸtirme KurallarÄ±
- Kod standartlarÄ±na uyun (ES6+)
- Yorum satÄ±rlarÄ± ekleyin
- DeÄŸiÅŸikliklerinizi test edin
- Commit mesajlarÄ±nÄ± aÃ§Ä±klayÄ±cÄ± yazÄ±n

---

## ðŸ“ Lisans

Bu proje MIT lisansÄ± altÄ±nda lisanslanmÄ±ÅŸtÄ±r. Detaylar iÃ§in [LICENSE](LICENSE) dosyasÄ±na bakÄ±n.

---

## ðŸ“ž Ä°letiÅŸim

- **Proje Linki**: [https://github.com/SherlockFP/Code0](https://github.com/SherlockFP/Code0)
- **Issues**: [https://github.com/SherlockFP/Code0/issues](https://github.com/SherlockFP/Code0/issues)

---

## ðŸ™ TeÅŸekkÃ¼rler

- [Socket.IO](https://socket.io/) - GerÃ§ek zamanlÄ± iletiÅŸim
- [Node.js](https://nodejs.org/) - Server runtime
- TÃ¼m katkÄ±da bulunanlara â¤ï¸

---

<div align="center">

**â­ Projeyi beÄŸendiyseniz yÄ±ldÄ±z vermeyi unutmayÄ±n!**

Made with â¤ï¸ by [SherlockFP](https://github.com/SherlockFP)

</div>

