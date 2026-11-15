# DLL622 Kelime Avı

DLL622 kanalının siyah, bordo ve neon kırmızı kimliğiyle hazırlanmış Türkçe kelime tahmin oyunu. 4, 5, 6, 7 ve 8 harfli kategorilerin her birinde günde beş bulmaca bulunur.

## Günlük sistem

- Günlük paket tarihi `Europe/Istanbul` saat dilimine göre belirlenir.
- Kelimeler tarih ve kategoriye göre deterministik karıştırılır; aynı sürümü ve aynı kelime havuzunu kullanan herkes aynı günlük cevapları görür.
- Açık sayfa gece yarısında paketi yeniler; sayfayı yenilemek gerekmez.
- Her oyuncunun tahminleri ve ilerlemesi kendi tarayıcısında tutulur; hesap veya veritabanı gerekmez.

## Yerelde hazırlama ve test

PowerShell terminalinde:

```powershell
npm.cmd run prepare:words
npm.cmd run build
```

İlk komut Türkçe kelime kaynağını indirerek `words.js` dosyasını oluşturur. Beklenen sonuç 2.500 hedef kelime (her uzunluk için 500) ve kaynakta bulunan uygun 4–8 harfli tahmin listesidir. Hazırlama sırasında kaynak erişilemezse hata görünür; test kelimeleriyle sessizce devam edilmez.

İkinci komut sözlüğün tam olduğunu doğrular ve dağıtım dosyalarını `dist/` içine kopyalar. Tam sözlük `words.js` dosyasında saklandığı için dosyayı GitHub deposuna yüklemek önemlidir. Böylece Vercel derlemesi, dosya zaten tam ise uzaktaki kelime kaynağını yeniden indirmek zorunda kalmaz.

## GitHub'a ilk yükleme

Boş deponun URL'sini kullanarak, proje klasöründe aşağıdaki komutları çalıştır. Öncesinde iki hazırlama komutunun da başarıyla bittiğini doğrula:

```powershell
git init
git add .
git commit -m "DLL622 Kelime Avı ilk sürüm"
git branch -M main
git remote add origin https://github.com/HAYRULLAH-DS187FAN/DLL622-kelime-avi.git
git push -u origin main
```

GitHub oturum açma penceresi çıkarsa kendi hesabınla devam et; şifre veya erişim anahtarını kimseyle paylaşma.

## Vercel

GitHub deposunu Vercel'de `Add New → Project → Import Git Repository` üzerinden içe aktar.

- Framework Preset: `Other`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Ayarlar `vercel.json` içinde de kayıtlıdır.

## Ödüllü reklam kurulumu

Oyunda reklamı isteğe bağlı bir akış olarak kullanmak için Google Ad Manager'da bir **Rewarded web ad unit** oluşturun. `ads-config.js` içindeki `enabled` değerini `true` yapıp `adUnitPath` alanına oluşturduğunuz ad unit path'ini yazın; örnek biçim `/123456789/dll622/rewarded` şeklindedir. Reklam tamamlanınca oyun, yalnızca Google'ın `rewardedSlotGranted` olayı geldiğinde bir ek tahmin hakkı verir. Reklam yarıda kapatılırsa ödül verilmez.

Google'ın web rewarded reklam koşullarında kullanıcıdan açıkça reklamı izleme tercihi alınması ve ödülün yayıncı tarafından teslim edilmesi gerekir. Reklam hesabınızdaki onay/consent ayarlarını ve ödüllü reklam politikalarını tamamlamadan `enabled: true` yapmayın. Teknik örnek ve güncel şartlar için [Google Publisher Tag rewarded ad örneğine](https://developers.google.com/publisher-tag/samples/display-rewarded-ad) ve [Google Ad Manager web rewarded reklam rehberine](https://support.google.com/admanager/answer/9116812) bakın.

## Kelime kaynağı ve lisans

Kaynak ve atıf ayrıntıları `ATTRIBUTION.md` dosyasındadır. Yayın öncesi bu dosyayı da dağıtımda tut.
