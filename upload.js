// OTOADA - upload.js
// Bu kod resim çakışması hatalarını önler ve API key'i güvenli şekilde kullanır.

// Seçilen dosyaları tutacak havuz
let selectedImageFiles = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication - only logged-in users can upload
    if (!supabase) {
        // Try to initialize if not already done
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            alert('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
            window.location.href = 'login.html';
            return;
        }
    }
    
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Error checking session:', error);
            alert('Kimlik doğrulama hatası. Lütfen tekrar giriş yapın.');
            window.location.href = 'login.html';
            return;
        }
        
        if (!session) {
            // No session, redirect to login
            alert('Bu sayfaya erişmek için giriş yapmanız gerekmektedir.');
            window.location.href = 'login.html';
            return;
        }
        
        // User is authenticated, continue with form setup
        
    } catch (error) {
        console.error('Error checking authentication:', error);
        alert('Kimlik doğrulama kontrolü başarısız. Lütfen tekrar giriş yapın.');
        window.location.href = 'login.html';
        return;
    }
    const form = document.getElementById('upload-form');
    const imageFileInput = document.getElementById('imageFile');
    const imageUploadStatus = document.getElementById('image-upload-status');
    const imageUploadText = document.getElementById('image-upload-text');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewGrid = document.getElementById('image-preview-grid');
    
    // --- KRİTİK AYAR: IMGBB API ANAHTARI BURADA ---
    // Başka dosyalarla çakışmasın diye ismini özelleştirdik.
    const myImgbbKey = '92f04d0a4a6d8bca493efe159e8f89ce'; 

    if (!form) {
        console.error('HATA: Upload formu bulunamadı (HTML id="upload-form" olmalı)');
        return;
    }

    // --- 1. DOSYA SEÇİMİ VE ÖNİZLEME ---
    if (imageFileInput) {
        imageFileInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            
            if (files.length === 0) { return; }

            // 7 Dosya Sınırı Kontrolü
            if (files.length > 7) {
                alert('Maksimum 7 resim seçebilirsiniz.');
                imageFileInput.value = ''; // Seçimi sıfırla
                selectedImageFiles = [];
                imagePreview.classList.add('hidden');
                return;
            }

            // Dosya Tipi ve Boyutu Kontrolü
            const validFiles = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) {
                    alert(`${file.name} resim dosyası değil!`);
                    continue;
                }
                validFiles.push(file);
            }

            if (validFiles.length === 0) {
                imageFileInput.value = '';
                return;
            }

            selectedImageFiles = validFiles;
            
            // Önizleme Gösterimi
            if (imagePreviewGrid) {
                imagePreviewGrid.innerHTML = ''; // Eski önizlemeleri temizle
                
                validFiles.forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const previewItem = document.createElement('div');
                        previewItem.className = 'relative';
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" class="w-full h-32 object-cover rounded-lg border border-gray-700">
                            <span class="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold">${index + 1}</span>
                        `;
                        imagePreviewGrid.appendChild(previewItem);
                    };
                    reader.readAsDataURL(file);
                });
                imagePreview.classList.remove('hidden');
            }
            
            // Durum yazısını gizle (yükleme başlayınca açılacak)
            if(imageUploadStatus) imageUploadStatus.classList.add('hidden');
        });
    }

    // --- 2. FORM GÖNDERME VE RESİM YÜKLEME ---
    form.addEventListener('submit', async function(e) {
        e.preventDefault(); // Sayfa yenilenmesini engelle

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton ? submitButton.textContent : 'İlanı Yayınla';

        // Form Verilerini Al
        const brand = document.getElementById('brand')?.value.trim();
        const model = document.getElementById('model')?.value.trim();
        const priceValue = document.getElementById('price')?.value.trim();
        const paraBirimi = document.getElementById('currency-select')?.value.trim() || 'STG';
        const yearValue = document.getElementById('year')?.value.trim();
        const kmValue = document.getElementById('km')?.value.trim();
        const description = document.getElementById('description')?.value.trim();
        const sellerName = document.getElementById('seller-name')?.value.trim();
        const sellerPhone = document.getElementById('seller-phone')?.value.trim();
        const konum = document.getElementById('konum')?.value.trim();
        const vites = document.getElementById('vites')?.value.trim();
        const yakit = document.getElementById('yakit')?.value.trim();

        // Basit Doğrulama
        if (!brand || !model || !priceValue || !selectedImageFiles.length) {
            alert('Lütfen marka, model, fiyat ve en az bir resim giriniz.');
            return;
        }

        // --- ADIM A: RESİMLERİ IMGBB'YE YÜKLE ---
        let uploadedImageUrls = [];

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Resimler Yükleniyor...';
            }
            
            if (imageUploadStatus) {
                imageUploadStatus.classList.remove('hidden');
                imageUploadText.textContent = `${selectedImageFiles.length} resim sunucuya yükleniyor...`;
                imageUploadText.className = 'text-sm text-yellow-600 font-medium';
            }

            // Promise.all ile tüm resimleri aynı anda gönderiyoruz (Hız için)
            const uploadPromises = selectedImageFiles.map(async (file, index) => {
                const formData = new FormData();
                formData.append('image', file);

                // API Key'i buraya yerleştirdik (myImgbbKey)
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${myImgbbKey}`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                
                if (data.success) {
                    return data.data.url;
                } else {
                    throw new Error(`Resim ${index + 1} hatası: ${data.error ? data.error.message : 'Bilinmeyen hata'}`);
                }
            });

            uploadedImageUrls = await Promise.all(uploadPromises);
            
            // Yükleme Başarılı
            if (imageUploadText) {
                imageUploadText.textContent = '✓ Resimler yüklendi, ilan kaydediliyor...';
                imageUploadText.className = 'text-sm text-green-600 font-bold';
            }

        } catch (error) {
            console.error('ImgBB Hatası:', error);
            alert('Resim yüklenirken hata oluştu: ' + error.message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            return; // Hata varsa dur
        }

        // --- ADIM B: SUPABASE'A KAYDET ---
        
        try {
            if (submitButton) submitButton.textContent = 'Veritabanına Yazılıyor...';

            // Check if Supabase client is configured
            if (!supabase) {
                // Try to initialize if not already done
                if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
                    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                } else {
                    throw new Error('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
                }
            }

            // Prepare car data (map to Supabase column names - snake_case)
            const carData = {
                marka: brand,
                model: model,
                fiyat: parseInt(priceValue),
                para_birimi: paraBirimi || 'STG',
                yil: parseInt(yearValue) || null,
                km: parseInt(kmValue) || null,
                aciklama: description || null,
                satici: sellerName || null,
                telefon: sellerPhone || null,
                konum: konum || null,
                vites: vites || null,
                yakit: yakit || null,
                durum: 'Onay Bekliyor'
            };

            // Insert car into Supabase
            const { data: carRecord, error: carError } = await supabase
                .from('cars')
                .insert(carData)
                .select()
                .single();

            if (carError) {
                throw new Error(carError.message || 'Supabase Hatası');
            }

            // Insert images into car_images table
            if (uploadedImageUrls.length > 0 && carRecord) {
                const imageRecords = uploadedImageUrls.map((url, index) => ({
                    car_id: carRecord.id,
                    image_url: url,
                    display_order: index
                }));

                const { error: imagesError } = await supabase
                    .from('car_images')
                    .insert(imageRecords);

                if (imagesError) {
                    console.warn('Car created but images failed to save:', imagesError);
                    // Don't throw - car is already created
                }
            }

            // MUTLU SON!
            alert('Harika! İlanın başarıyla gönderildi ve onaya düştü.');
            window.location.reload(); // Sayfayı yenile

        } catch (error) {
            console.error('Supabase Hatası:', error);
            alert('İlan kaydedilemedi: ' + error.message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
});