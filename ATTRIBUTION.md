# Kelime verisi — kaynak ve lisans

DLL622 Kelime Avı iki ayrı amaç için sözlük verisi kullanır: günlük cevaplar için bilinen bir çekirdek liste, tahminler için daha geniş bir sözlük ve özel isim listeleri.

## Kaynaklar

- **Pulmaca çekirdek kelime listesi** (`pulmaca-cekirdek.txt`): https://pulmaca.com.tr/veri/ — sık kullanılan hedef adayları için kullanılır. Pulmaca bu veriyi CC BY-SA 4.0 lisansıyla yayımlar.
- **TDK tabanlı kelime listesi** (`turkish_words_raw.txt`): https://github.com/ahakanacar/turkish-dictionary-dataset-and-statistics — kaynak deposu 64.750+ Türkçe kelime içeren derlenmiş listeyi MIT lisansıyla sunar ve verinin TDK Güncel Türkçe Sözlük indeksinden işlendiğini belirtir.
- **Pulmaca özel isim, şehir ve ülke listeleri**: https://pulmaca.com.tr/veri/kategoriler/ — tahminlerde özel isimleri kabul etmek için kullanılır; Pulmaca bu listeleri CC BY-SA 4.0 lisansıyla yayımlar.

## Hazırlama yöntemi

Hedef kelimeler, Pulmaca çekirdek listesindeki adayların TDK tabanlı kelime listesindeki küçük harfli sözlük girdileriyle doğrulanmasıyla seçilir. Gerekli sayıya ulaşılamazsa TDK tabanlı listeden tamamlanır. Bu nedenle Pulmaca'nın geniş listesinde bulunabilen fakat TDK tabanlı listede bulunmayan `sunny` gibi girdiler hedef veya tahmin listesine otomatik eklenmez.

Tahmin listesi, TDK tabanlı 4–8 harfli girdileri ve aynı harf/uzunluk denetiminden geçirilen özel isim, şehir ve ülke listelerini kapsar. Özel isimler tahmin edilebilir; günlük hedef havuzuna yalnızca küçük harfli sözlük girdileri alınır.

Bu dosya kaynakları tanımlar; ilgili veri kaynaklarının lisans koşulları ayrıca geçerlidir. Pulmaca'dan türetilen veriler paylaşılırken CC BY-SA 4.0 atfı ve ilgili lisans koşulları korunmalıdır.
