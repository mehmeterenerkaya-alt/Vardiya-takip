# Vardiya Takip — ilk sürüm

Bu proje telefon + şifre girişi kullanan, mobil ekrana uyumlu bir web uygulaması iskeletidir. iPhone ana ekranına eklenebilir. Gerçek çok cihazlı senkronizasyon Supabase bulut veritabanı üzerinden yapılır.

## Kurulum
1. https://supabase.com adresinde yeni bir proje oluşturun.
2. Project Settings → API bölümünden Project URL ve anon/public key değerlerini alın.
3. `config.js` içindeki `SUPABASE_PROJECT_URL` ve `SUPABASE_ANON_PUBLIC_KEY` alanlarını doldurun.
4. Supabase → SQL Editor bölümünde `schema.sql` dosyasının tamamını çalıştırın.
5. Authentication → Providers → Phone özelliğini etkinleştirin. Telefon+şifre girişi için Phone provider ve password login ayarlarını kontrol edin.
6. Authentication → Users bölümünden yönetici telefonunu ve ilk şifresini oluşturun. Kullanıcının UUID'sini kopyalayın.
7. SQL Editor'da README sonundaki yönetici INSERT örneğini kendi ad, telefon ve UUID'nizle çalıştırın.
8. Çalışan hesaplarını Supabase Authentication → Users bölümünden tek tek telefon ve geçici şifre ile oluşturun. Her kullanıcı için `profiles` tablosuna aynı UUID, ad, telefon, günlük ücret ve `employee` rolüyle kayıt ekleyin. İlk girişten sonra çalışanlar şifrelerini değiştirmelidir.
9. Bu klasörü HTTPS destekleyen statik hostinge (ör. Netlify veya Vercel) yayınlayın. `index.html`, `app.js`, `style.css`, `config.js`, `manifest.webmanifest` dosyaları aynı klasörde kalmalı.

## iPhone'a ekleme
Yayınlanan HTTPS adresini Safari'de açın → Paylaş → Ana Ekrana Ekle.

## Önemli notlar
- 10 kişilik toplam kapasite (yönetici dahil) arayüzde gösterilir. Yeni hesap açarken bu sınırı yönetici uygulamalıdır.
- Bu başlangıç sürümünde çalışan hesapları Supabase panelinden oluşturulur; uygulama içinden güvenli hesap açma için ayrıca sunucu taraflı yönetici fonksiyonu gerekir.
- Ücret ve avans gizliliği RLS politikalarıyla korunur. Yayına almadan önce RLS politikalarını ve telefon doğrulama/şifre sıfırlama akışını test edin.
- Bu kaynak henüz internette yayınlanmış değildir; gerçek bulut senkronizasyonu Supabase projesi ve hosting kurulumu tamamlandıktan sonra çalışır.


## Maaş ödemesi takibi (bu sürüm)
- Yönetici, çalışan seçerek kısmi veya tam maaş ödemesi kaydedebilir.
- Her ödeme tarihi, tutarı ve açıklamasıyla ayrı satırda saklanır.
- Maaş ekranı seçilen ay için `onaylı çalışma günleri × günlük ücret − avanslar − maaş ödemeleri` hesabını gösterir.
- Çalışan yalnızca kendi maaş özeti, avansları ve maaş ödeme geçmişini görür; yönetici tüm çalışanları görür.
- Tam ödeme sonrası kalan bakiye sıfırlanır (fazla ödeme varsa negatif bakiye olarak görünür; kayıt otomatik silinmez).

## Önemli kurulum notu
Bu paket uygulamanın kaynak dosyalarıdır; henüz internette yayınlanmış veya bir Supabase projesine bağlanmış değildir. `schema.sql` dosyasının tamamını Supabase SQL Editor'da çalıştırın, ardından `config.js` içine proje URL'si ve anon key girin. Yönetici ve çalışan hesapları Supabase Auth üzerinden oluşturulup `profiles` tablosuna bağlanmalıdır. `salary_payments` tablosu ve güvenlik kuralları bu pakette dahildir.
