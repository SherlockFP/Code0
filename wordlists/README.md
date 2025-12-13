# Wordlists

Server, eğer `wordlists/<kategori>.txt` dosyası varsa o kategori için built-in kelime listesini bununla override eder.

- Örnek: `wordlists/genel.txt`
- Format: Her satır 1 kelime
- `#` ile başlayan satırlar yorum sayılır ve yok sayılır
- En az 25 kelime olmalı (Codenames board'u için)

## Senin isteğin (EN listeyi TR yapıp eklemek)

Linkteki İngilizce listeyi otomatik olarak Türkçe'ye çevirmek için bir çeviri kaynağı (API / hazır sözlük / manuel mapping) gerekiyor.
Bu repo içinde telif/kalite riskine girmemek için çeviriyi “hazır çıktı” olarak repo'ya gömmedim.

Yapılabilecek en temiz yol:
1. İngilizce listeden bir çeviri tablosu çıkar
2. Türkçe karşılıkları doldur
3. Sonuçları `wordlists/genel.txt` içine koy

### AI ile otomatik çeviri (lokalde)

Bu projede bunun için script var:

1) İngilizce listeyi indir:
- `node tools/fetch-en-wordlist.js`

2) OpenAI API key ayarla:
- PowerShell: `setx OPENAI_API_KEY "..."` (terminali yeniden aç)
- İstersen model: `setx OPENAI_MODEL "gpt-4o-mini"`

3) Türkçe listeyi üret:
- `node tools/translate-en-wordlist-to-tr.js`

Script çıktıyı şuraya yazar:
- `wordlists/genel.txt`

Sonra server yeni oyun başlatırken otomatik bu dosyayı kullanır.

İstersen bana:
- Hazır Türkçe karşılık listeni (txt/csv)
- veya hangi çeviri kaynağını kullanacağımızı
söyle, onu da otomatikleştireyim.
