// Detail Page - Fetch and display single car record from Supabase

// Global variable to store current car data for story generation
let currentCarData = null;

// Utility function to format price with currency
function formatPrice(fiyat, paraBirimi) {
    // Check ParaBirimi field - default to STG if undefined/empty
    let symbol = '£'; // Default to STG symbol
    
    if (paraBirimi === 'TL' || paraBirimi === 'tl') {
        symbol = '₺';
    } else if (paraBirimi === 'EUR' || paraBirimi === 'eur') {
        symbol = '€';
    } else if (paraBirimi === 'STG' || paraBirimi === 'stg') {
        symbol = '£';
    }
    // If paraBirimi is undefined, empty, or anything else, default to £ (already set)
    
    // Format number with commas for thousands separators (e.g., 15000 -> 15,000)
    let formattedNumber = '';
    if (typeof fiyat === 'number') {
        formattedNumber = fiyat.toLocaleString('en-US');
    } else if (fiyat) {
        const numValue = parseInt(fiyat);
        if (!isNaN(numValue)) {
            formattedNumber = numValue.toLocaleString('en-US');
        } else {
            formattedNumber = fiyat.toString();
        }
    } else {
        formattedNumber = '0';
    }
    
    return `${symbol}${formattedNumber}`;
}

// Utility function to clean phone number for WhatsApp
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all spaces, dashes, parentheses, and other non-numeric characters except +
    let cleaned = phone.toString().replace(/[\s\-\(\)\.]/g, '');
    
    // Remove leading + if present (we'll add it back if needed)
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    
    // Return cleaned number (without + for WhatsApp API)
    return cleaned;
}

async function fetchCarDetail() {
    // Check if Supabase client is configured
    if (!supabase) {
        // Try to initialize if not already done
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.warn('Supabase client not configured. Please check config.js.');
            showError('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
            return;
        }
    }

    // Get record ID from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        console.error('No record ID found in URL');
        showError('İlan bulunamadı. Lütfen geçerli bir ilan seçin.');
        return;
    }

    try {
        // Fetch car with images join (explicit foreign key constraint: car_images_car_id_fkey)
        const { data, error } = await supabase
            .from('cars')
            .select(`
                *,
                car_images!car_images_car_id_fkey (
                    id,
                    image_url,
                    thumbnail_url,
                    display_order
                )
            `)
            .eq('id', recordId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('İlan bulunamadı.');
            }
            throw new Error(error.message);
        }

        // Transform Supabase data to match frontend format
        const transformed = transformSupabaseCarForDetail(data);
        currentCarData = transformed; // Store car data globally
        populateCarDetail(transformed);
    } catch (error) {
        console.error('Error fetching car detail from Supabase:', error);
        showError(error.message || 'Veri yüklenirken bir hata oluştu.');
    }
}

// Helper function to transform Supabase data to match frontend format
function transformSupabaseCarForDetail(car) {
    // Get all images from car_images relationship, sorted by display_order
    let images = [];
    if (car.car_images && Array.isArray(car.car_images) && car.car_images.length > 0) {
        const sortedImages = car.car_images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        images = sortedImages.map(img => ({
            url: img.image_url || img.thumbnail_url || '',
            thumbnails: {
                large: { url: img.thumbnail_url || img.image_url || '' }
            }
        }));
    }
    
    // Transform to match frontend expected format (PascalCase field names)
    return {
        id: car.id,
        createdTime: car.created_at,
        fields: {
            Marka: car.marka || '',
            Model: car.model || '',
            Fiyat: car.fiyat || 0,
            ParaBirimi: car.para_birimi || 'STG',
            Durum: car.durum || 'Onay Bekliyor',
            Yil: car.yil || '',
            KM: car.km || '',
            Yakit: car.yakit || '',
            Vites: car.vites || '',
            'Kasa Tipi': car.kasa_tipi || '',
            Renk: car.renk || '',
            Aciklama: car.aciklama || '',
            Satici: car.satici || '',
            Telefon: car.telefon || '',
            Konum: car.konum || '',
            Ekspertiz: car.ekspertiz || '',
            // Images array format for UI rendering
            Resim: images
        }
    };
}

function populateCarDetail(record) {
    const fields = record.fields;

    // Extract field values (handle different possible field names)
    const marka = fields.Marka || fields.marka || '';
    const model = fields.Model || fields.model || '';
    const fiyat = fields.Fiyat || fields.fiyat || 0;
    const paraBirimi = fields.ParaBirimi || fields.paraBirimi || 'STG';
    const yil = fields.Yil || fields.yil || fields.Yıl || fields.yıl || '';
    const km = fields.KM || fields.km || fields.Kilometre || fields.kilometre || '';
    const yakıt = fields.Yakıt || fields.yakıt || fields.Yakit || fields.yakit || '';
    const vites = fields.Vites || fields.vites || '';
    const kasaTipi = fields['Kasa Tipi'] || fields['Kasa Tipi'] || fields.KasaTipi || fields.kasaTipi || fields.Kasa || fields.kasa || '';
    const renk = fields.Renk || fields.renk || '';
    const konum = fields.Konum || fields.konum || '';
    const aciklama = fields.Aciklama || fields.aciklama || fields.Açıklama || fields.açıklama || '';
    const resim = fields.Resim || fields.resim || fields.Image || fields.image || '';
    const ekspertiz = fields.Ekspertiz || fields.ekspertiz || fields['Hasar Durumu'] || fields['hasar durumu'] || '';
    
    // Seller information - Map Satici and Telefon fields
    const satici = fields.Satici || fields.satici || '';
    const telefon = fields.Telefon || fields.telefon || '';

    // Update Title
    const titleElement = document.getElementById('car-title');
    if (titleElement) {
        titleElement.textContent = `${marka} ${model}`.trim() || 'Araç İlanı';
    }

    // Update Price with currency
    const priceElement = document.getElementById('car-price');
    if (priceElement) {
        const formattedPrice = formatPrice(fiyat, paraBirimi);
        priceElement.textContent = formattedPrice;
    }

    // Update Specs
    updateSpec('car-marka', marka);
    updateSpec('car-model', model);
    updateSpec('car-yil', yil);
    updateSpec('car-km', km ? `${km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} KM` : '');
    updateSpec('car-yakit', yakıt);
    updateSpec('car-vites', vites);
    updateSpec('car-kasa-tipi', kasaTipi);
    updateSpec('car-renk', renk);
    updateSpec('car-konum', konum);

    // Update Description
    try {
        const descriptionElement = document.getElementById('car-description');
        if (descriptionElement) {
            if (aciklama && typeof aciklama === 'string') {
                // Split by newlines and create paragraphs
                const paragraphs = aciklama.split('\n').filter(p => p.trim() !== '');
                // Escape HTML to prevent XSS and errors
                const safeParagraphs = paragraphs.map(p => {
                    const text = p.trim();
                    const div = document.createElement('div');
                    div.textContent = text;
                    return `<p>${div.innerHTML}</p>`;
                }).join('');
                descriptionElement.innerHTML = safeParagraphs;
            } else {
                descriptionElement.innerHTML = '<p class="text-gray-500">Açıklama bulunmamaktadır.</p>';
            }
        }
    } catch (error) {
        console.error('Error rendering description:', error);
        const descriptionElement = document.getElementById('car-description');
        if (descriptionElement) {
            descriptionElement.innerHTML = '<p class="text-gray-500">Açıklama yüklenirken bir hata oluştu.</p>';
        }
    }

    // Update Images
    updateImages(resim);

    // Update Ekspertiz/Hasar Durumu
    updateEkspertiz(ekspertiz);
    
    // Update Seller Information
    updateSellerInfo(satici, telefon, marka, model);
    
    // Load similar cars
    renderSimilarCars(record);
    
    // Setup favorites button
    setupFavoritesButton(record.id);
}

function updateSpec(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value || '-';
    }
}

function updateImages(resim) {
    const mainImage = document.getElementById('main-image-img');
    const mainImagePlaceholder = document.getElementById('main-image-placeholder');
    const thumbnailsContainer = document.querySelector('.grid.grid-cols-4.gap-3');

    // Get image URLs from stored image array
    let imageUrls = [];
    if (Array.isArray(resim) && resim.length > 0) {
        imageUrls = resim.map(img => img.url || img.thumbnails?.large?.url || '').filter(url => url);
    } else if (typeof resim === 'string' && resim.trim() !== '') {
        imageUrls = [resim];
    }

    if (imageUrls.length > 0) {
        // Update main image
        if (mainImage) {
            mainImage.src = imageUrls[0];
            mainImage.alt = document.getElementById('car-title')?.textContent || 'Araç Görseli';
            mainImage.style.display = 'block';
            
            mainImage.addEventListener('load', () => {
                if (mainImagePlaceholder) {
                    mainImagePlaceholder.style.display = 'none';
                }
            });

            mainImage.addEventListener('error', () => {
                if (mainImagePlaceholder) {
                    mainImagePlaceholder.style.display = 'flex';
                }
            });
        }

        // Update thumbnails
        if (thumbnailsContainer) {
            thumbnailsContainer.innerHTML = '';
            imageUrls.forEach((url, index) => {
                const thumbnailHTML = `
                    <div class="thumbnail ${index === 0 ? 'active' : ''} rounded-lg overflow-hidden h-20 md:h-24" onclick="changeMainImage(${index})" data-image="${url}">
                        <img src="${url}" alt="Thumbnail ${index + 1}" class="w-full h-full object-cover">
                    </div>
                `;
                thumbnailsContainer.insertAdjacentHTML('beforeend', thumbnailHTML);
            });
        }
    } else {
        // No images - show placeholder
        if (mainImagePlaceholder) {
            mainImagePlaceholder.style.display = 'flex';
        }
        if (mainImage) {
            mainImage.style.display = 'none';
        }
    }
}

function updateEkspertiz(ekspertiz) {
    const ekspertizElement = document.getElementById('car-ekspertiz');
    if (ekspertizElement) {
        if (ekspertiz) {
            ekspertizElement.textContent = ekspertiz;
        } else {
            ekspertizElement.textContent = 'Bilgi bulunmamaktadır.';
        }
    }
}

function updateSellerInfo(satici, telefon, marka = '', model = '') {
    // Get seller name - fallback to 'Sahibinden' if empty
    const sellerName = (satici && satici.trim() !== '') ? satici.trim() : 'Sahibinden';
    
    // Update seller name display
    const sellerNameElement = document.getElementById('seller-name');
    if (sellerNameElement) {
        sellerNameElement.textContent = sellerName;
    }
    
    // Update phone number and links
    if (telefon && telefon.trim() !== '') {
        const phoneNumber = telefon.trim(); // Keep original for display
        
        // Clean phone number for WhatsApp (strip spaces, dashes, etc.)
        const cleanPhoneForWhatsApp = cleanPhoneNumber(phoneNumber);
        
        // For tel: links, keep the original format but clean it slightly
        const cleanPhoneForTel = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Update phone text display (keep readable format)
        const phoneTextElement = document.getElementById('seller-phone-text');
        if (phoneTextElement) {
            phoneTextElement.textContent = phoneNumber;
        }
        
        // Update phone link (tel:) - use cleaned version
        const phoneLink = document.getElementById('seller-phone-link');
        if (phoneLink) {
            phoneLink.href = `tel:${cleanPhoneForTel}`;
            // Also add WhatsApp link as alternative (wrap in WhatsApp)
            phoneLink.setAttribute('data-whatsapp', `https://wa.me/${cleanPhoneForWhatsApp}`);
        }
        
        // Update mobile phone link
        const mobilePhoneLink = document.getElementById('mobile-seller-phone-link');
        if (mobilePhoneLink) {
            mobilePhoneLink.href = `tel:${cleanPhoneForTel}`;
            // Also add WhatsApp link as alternative
            mobilePhoneLink.setAttribute('data-whatsapp', `https://wa.me/${cleanPhoneForWhatsApp}`);
        }
        
        // Update WhatsApp links
        const whatsappLink = document.getElementById('seller-whatsapp-link');
        if (whatsappLink) {
            whatsappLink.href = `https://wa.me/${cleanPhoneForWhatsApp}`;
        }
        
        const mobileWhatsappLink = document.getElementById('mobile-seller-whatsapp-link');
        if (mobileWhatsappLink) {
            mobileWhatsappLink.href = `https://wa.me/${cleanPhoneForWhatsApp}`;
        }
        
        // Update Direct WhatsApp button with message
        const whatsappBtn = document.getElementById('whatsapp-btn');
        if (whatsappBtn) {
            // Create the message: 'Selam, [Marka] [Model] ilanı için yazıyorum (Otoada).'
            const carTitle = `${marka} ${model}`.trim();
            const message = `Selam, ${carTitle} ilanı için yazıyorum (Otoada).`;
            const encodedMessage = encodeURIComponent(message);
            
            // Set the WhatsApp link with phone and pre-filled message
            whatsappBtn.href = `https://wa.me/${cleanPhoneForWhatsApp}?text=${encodedMessage}`;
        }
    } else {
        // No phone number - disable links
        const phoneTextElement = document.getElementById('seller-phone-text');
        if (phoneTextElement) {
            phoneTextElement.textContent = 'Telefon bulunamadı';
        }
        
        // Remove href from links to disable them
        const phoneLink = document.getElementById('seller-phone-link');
        if (phoneLink) {
            phoneLink.removeAttribute('href');
            phoneLink.style.opacity = '0.5';
            phoneLink.style.cursor = 'not-allowed';
        }
        
        const mobilePhoneLink = document.getElementById('mobile-seller-phone-link');
        if (mobilePhoneLink) {
            mobilePhoneLink.removeAttribute('href');
            mobilePhoneLink.style.opacity = '0.5';
            mobilePhoneLink.style.cursor = 'not-allowed';
        }
        
        const whatsappLink = document.getElementById('seller-whatsapp-link');
        if (whatsappLink) {
            whatsappLink.removeAttribute('href');
            whatsappLink.style.opacity = '0.5';
            whatsappLink.style.cursor = 'not-allowed';
        }
        
        const mobileWhatsappLink = document.getElementById('mobile-seller-whatsapp-link');
        if (mobileWhatsappLink) {
            mobileWhatsappLink.removeAttribute('href');
            mobileWhatsappLink.style.opacity = '0.5';
            mobileWhatsappLink.style.cursor = 'not-allowed';
        }
        
        // Disable Direct WhatsApp button
        const whatsappBtn = document.getElementById('whatsapp-btn');
        if (whatsappBtn) {
            whatsappBtn.removeAttribute('href');
            whatsappBtn.style.opacity = '0.5';
            whatsappBtn.style.cursor = 'not-allowed';
            whatsappBtn.style.pointerEvents = 'none';
        }
    }
}

function showError(message) {
    const titleElement = document.getElementById('car-title');
    const priceElement = document.getElementById('car-price');
    
    if (titleElement) {
        titleElement.textContent = 'Hata';
    }
    if (priceElement) {
        priceElement.textContent = '';
    }

    const descriptionElement = document.getElementById('car-description');
    if (descriptionElement) {
        descriptionElement.innerHTML = `<p class="text-red-400">${message}</p>`;
    }
}

// Share functionality
function setupShareButton() {
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const currentUrl = window.location.href;
            
            try {
                // Try using Clipboard API
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(currentUrl);
                    alert('Link kopyalandı!');
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = currentUrl;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Link kopyalandı!');
                }
            } catch (error) {
                console.error('Failed to copy URL:', error);
                alert('Link kopyalanırken bir hata oluştu.');
            }
        });
    }
}

// Similar Cars functionality
async function renderSimilarCars(currentCar) {
    const container = document.getElementById('similar-cars-container');
    if (!container) {
        console.error('Similar cars container not found');
        return;
    }

    // Check if Supabase client is configured
    if (!supabase) {
        console.warn('Supabase client not configured. Cannot load similar cars.');
        return;
    }

    const currentFields = currentCar.fields || {};
    const currentMarka = currentFields.Marka || currentFields.marka || '';
    const currentId = currentCar.id;
    
    try {
        // Fetch cars with status 'Yayında' and same brand, with images join (explicit foreign key constraint: car_images_car_id_fkey)
        const { data, error } = await supabase
            .from('cars')
            .select(`
                *,
                car_images!car_images_car_id_fkey (
                    id,
                    image_url,
                    thumbnail_url,
                    display_order
                )
            `)
            .eq('durum', 'Yayında')
            .eq('marka', currentMarka)
            .neq('id', currentId)
            .limit(4);

        if (error) {
            throw new Error(error.message);
        }

        // Transform Supabase data to match frontend format
        let similarCars = (data || []).map(car => transformSupabaseCarForDetail(car));

        // Fallback: If no same-brand cars, show random 3 cars (excluding current)
        if (similarCars.length === 0) {
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('cars')
                .select(`
                    *,
                    car_images!car_images_car_id_fkey (
                        id,
                        image_url,
                        thumbnail_url,
                        display_order
                    )
                `)
                .eq('durum', 'Yayında')
                .neq('id', currentId)
                .limit(3);
            
            if (!fallbackError && fallbackData) {
                similarCars = fallbackData.map(car => transformSupabaseCarForDetail(car));
            }
        }

        // Render similar car cards
        if (similarCars.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-400">Benzer ilan bulunamadı.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        similarCars.forEach(record => {
            const cardHTML = createCarCardHTML(record);
            container.insertAdjacentHTML('beforeend', cardHTML);
        });

    } catch (error) {
        console.error('Error fetching similar cars:', error);
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-gray-400">Benzer ilanlar yüklenirken bir hata oluştu.</p>
            </div>
        `;
    }
}

// Reusable function to create car card HTML (same as index page)
function createCarCardHTML(record) {
    const fields = record.fields || {};
    
    const marka = fields.Marka || fields.marka || '';
    const model = fields.Model || fields.model || '';
    const fiyat = fields.Fiyat || fields.fiyat || 0;
    const paraBirimi = fields.ParaBirimi || fields.paraBirimi || 'STG';
    const yil = fields.Yil || fields.yil || fields.Yıl || fields.yıl || '';
    const km = fields.KM || fields.km || fields.Kilometre || fields.kilometre || '';
    const resim = fields.Resim || fields.resim || fields.Image || fields.image || '';
    const satici = fields.Satici || fields.satici || '';
    const konum = fields.Konum || fields.konum || '';
    const vites = fields.Vites || fields.vites || '';
    const yakit = fields.Yakit || fields.yakit || '';
    
    // Get first image URL if Resim is an array
    let imageUrl = '';
    if (Array.isArray(resim) && resim.length > 0) {
        imageUrl = resim[0].url || resim[0].thumbnails?.large?.url || '';
    } else if (typeof resim === 'string' && resim.trim() !== '') {
        imageUrl = resim;
    }

    // Format price with currency
    const formattedPrice = formatPrice(fiyat, paraBirimi);
    const formattedKM = km ? `${km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} KM` : '';

    // Build specs line
    const specsParts = [];
    if (vites) specsParts.push(vites);
    if (yakit) specsParts.push(yakit);
    const specsLine = specsParts.length > 0 ? specsParts.join(' • ') : '';

    return `
        <a href="detail.html?id=${record.id}" class="car-card rounded-xl overflow-hidden relative block">
            <div class="relative h-48 ${imageUrl ? '' : 'car-image-placeholder'}">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="${marka} ${model}" class="w-full h-full object-cover">`
                    : `
                    <div class="absolute inset-0 flex items-center justify-center">
                        <svg class="w-20 h-20 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </div>
                    `
                }
            </div>
            <div class="p-5">
                <h4 class="text-xl font-bold text-white mb-2">${marka} ${model}</h4>
                <p class="text-2xl font-bold gold-text mb-3">${formattedPrice}</p>
                
                ${satici ? `<p class="text-white font-bold mb-2">${satici}</p>` : ''}
                
                ${konum ? `
                <div class="flex items-center gap-1.5 text-blue-400 mb-3">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span class="text-sm font-medium">${konum}</span>
                </div>
                ` : ''}
                
                ${specsLine ? `<p class="text-sm text-gray-400 mb-4">${specsLine}</p>` : ''}
                
                <div class="space-y-2 text-sm text-gray-400">
                    ${yil ? `
                    <div class="flex items-center justify-between">
                        <span>Yıl:</span>
                        <span class="text-white font-medium">${yil}</span>
                    </div>
                    ` : ''}
                    ${formattedKM ? `
                    <div class="flex items-center justify-between">
                        <span>Kilometre:</span>
                        <span class="text-white font-medium">${formattedKM}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </a>
    `;
}

// Favorites localStorage functions
function getFavorites() {
    try {
        const favorites = localStorage.getItem('otoada_favorites');
        return favorites ? JSON.parse(favorites) : [];
    } catch (error) {
        console.error('Error reading favorites from localStorage:', error);
        return [];
    }
}

function saveFavorites(favorites) {
    try {
        localStorage.setItem('otoada_favorites', JSON.stringify(favorites));
        updateFavoritesBadge();
    } catch (error) {
        console.error('Error saving favorites to localStorage:', error);
    }
}

function isFavorite(carId) {
    const favorites = getFavorites();
    return favorites.includes(carId);
}

function updateFavoritesBadge() {
    const favorites = getFavorites();
    const count = favorites.length;
    
    const badge = document.getElementById('favorites-badge');
    const mobileBadge = document.getElementById('mobile-favorites-badge');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    if (mobileBadge) {
        if (count > 0) {
            mobileBadge.textContent = count;
            mobileBadge.classList.remove('hidden');
        } else {
            mobileBadge.classList.add('hidden');
        }
    }
}

// Setup favorites button on detail page
function setupFavoritesButton(carId) {
    const favoritesBtn = document.getElementById('favorites-btn');
    if (!favoritesBtn) return;

    const isCurrentlyFavorite = isFavorite(carId);
    updateFavoritesButtonUI(favoritesBtn, isCurrentlyFavorite);

    favoritesBtn.onclick = (e) => {
        e.preventDefault();
        toggleFavoriteDetail(carId, favoritesBtn);
    };
}

function updateFavoritesButtonUI(button, isFavorite) {
    const svg = button.querySelector('svg');
    const span = button.querySelector('span');

    if (isFavorite) {
        // Already favorited - show remove state (red/gray)
        button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        button.classList.add('bg-red-600', 'hover:bg-red-700');
        svg.setAttribute('fill', '#ef4444');
        svg.setAttribute('stroke', '#ef4444');
        span.textContent = 'Favorilerden Çıkar';
    } else {
        // Not favorited - show add state (gray)
        button.classList.remove('bg-red-600', 'hover:bg-red-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        span.textContent = 'Favorilere Ekle';
    }
}

function toggleFavoriteDetail(carId, buttonElement) {
    let favorites = getFavorites();
    const index = favorites.indexOf(carId);
    let isCurrentlyFavorite;

    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        isCurrentlyFavorite = false;
    } else {
        // Add to favorites
        favorites.push(carId);
        isCurrentlyFavorite = true;
    }
    
    saveFavorites(favorites);
    
    // Immediately update button UI - change to green with checkmark when added
    const svg = buttonElement.querySelector('svg');
    const span = buttonElement.querySelector('span');
    
    if (isCurrentlyFavorite) {
        // Just added - show success state (green with checkmark)
        buttonElement.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        buttonElement.classList.add('bg-green-600', 'hover:bg-green-700');
        
        // Change icon to checkmark
        svg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />`;
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        span.textContent = 'Favorilere Eklendi!';
        
        // After 2 seconds, revert to normal "favorited" state (red)
        setTimeout(() => {
            updateFavoritesButtonUI(buttonElement, true);
        }, 2000);
    } else {
        // Removed - update to normal state
        updateFavoritesButtonUI(buttonElement, false);
    }
    
    updateFavoritesBadge();
}

// Instagram Story Generation - Modal Preview Approach
function setupInstagramStoryButton() {
    const storyBtn = document.getElementById('instagram-story-btn');
    
    if (storyBtn) {
        storyBtn.addEventListener('click', () => {
            if (!currentCarData) {
                alert('Araç bilgileri yüklenemedi. Lütfen sayfayı yenileyin.');
                return;
            }
            openStoryPreview();
        });
    }
}

// Open Story Preview Modal
function openStoryPreview() {
    if (!currentCarData) {
        alert('Araç bilgileri yüklenemedi. Lütfen sayfayı yenileyin.');
        return;
    }
    
    const fields = currentCarData.fields;
    const marka = fields.Marka || fields.marka || '';
    const model = fields.Model || fields.model || '';
    const fiyat = fields.Fiyat || fields.fiyat || 0;
    const paraBirimi = fields.ParaBirimi || fields.paraBirimi || 'STG';
    const yil = fields.Yil || fields.yil || fields.Yıl || fields.yıl || '';
    const km = fields.KM || fields.km || fields.Kilometre || fields.kilometre || '';
    const yakıt = fields.Yakıt || fields.yakıt || fields.Yakit || fields.yakit || '';
    const vites = fields.Vites || fields.vites || '';
    const resim = fields.Resim || fields.resim || fields.Image || fields.image || '';
    
    // Get first image URL
    let imageUrl = '';
    if (Array.isArray(resim) && resim.length > 0) {
        imageUrl = resim[0].url || resim[0].thumbnails?.large?.url || '';
    } else if (typeof resim === 'string' && resim.trim() !== '') {
        imageUrl = resim;
    }
    
    // Format price with currency
    const formattedPrice = formatPrice(fiyat, paraBirimi);
    const title = `${marka} ${model}`.trim() || 'Araç İlanı';
    const formattedKM = km ? `${km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} KM` : '';
    
    // Populate preview elements
    const priceElement = document.getElementById('story-price-preview');
    const titleElement = document.getElementById('story-title-preview');
    const imageElement = document.getElementById('story-image-preview');
    const yearElement = document.getElementById('story-year-preview');
    const kmElement = document.getElementById('story-km-preview');
    const fuelElement = document.getElementById('story-fuel-preview');
    const gearElement = document.getElementById('story-gear-preview');
    
    if (priceElement) {
        priceElement.textContent = formattedPrice;
    }
    
    if (titleElement) {
        titleElement.textContent = title.toUpperCase();
    }
    
    if (imageElement && imageUrl) {
        imageElement.src = imageUrl;
        imageElement.alt = title;
    }
    
    // Update specs
    if (yearElement) {
        const yearSpan = yearElement.querySelector('span');
        if (yearSpan) {
            yearSpan.textContent = yil || '-';
        }
    }
    
    if (kmElement) {
        const kmSpan = kmElement.querySelector('span');
        if (kmSpan) {
            kmSpan.textContent = formattedKM || '-';
        }
    }
    
    if (fuelElement) {
        const fuelSpan = fuelElement.querySelector('span');
        if (fuelSpan) {
            fuelSpan.textContent = yakıt || '-';
        }
    }
    
    if (gearElement) {
        const gearSpan = gearElement.querySelector('span');
        if (gearSpan) {
            gearSpan.textContent = vites || '-';
        }
    }
    
    // Show modal
    const modal = document.getElementById('story-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// Close Story Modal
function closeStoryModal() {
    const modal = document.getElementById('story-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Download Story Image
async function downloadStoryImage() {
    const previewContainer = document.getElementById('story-preview');
    
    if (!previewContainer) {
        alert('Önizleme bulunamadı.');
        return;
    }
    
    if (typeof html2canvas === 'undefined') {
        alert('html2canvas kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.');
        return;
    }
    
    // Wait for image to load if present
    const imageElement = document.getElementById('story-image-preview');
    if (imageElement && imageElement.src) {
        await new Promise((resolve) => {
            if (imageElement.complete) {
                resolve();
            } else {
                imageElement.onload = resolve;
                imageElement.onerror = resolve;
                setTimeout(resolve, 3000); // Timeout after 3 seconds
            }
        });
    }
    
    // Wait a bit for rendering
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
        // Capture the actual 1080x1920px element (it's visually scaled but physically full size)
        // Use scale: 1 since the element is already high-resolution
        const canvas = await html2canvas(previewContainer, {
            useCORS: true,
            scale: 1, // Element is already 1080x1920px, no need to scale up
            width: 1080,
            height: 1920,
            backgroundColor: null,
            logging: false
        });
        
        // Convert canvas to blob and trigger download
        canvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Görsel oluşturulamadı.');
            }
            
            // Generate filename with car name
            const fields = currentCarData?.fields || {};
            const marka = fields.Marka || fields.marka || '';
            const model = fields.Model || fields.model || '';
            const safeMarka = marka.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'car';
            const safeModel = model.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'model';
            const filename = `otoada-story-${safeMarka}-${safeModel}.png`;
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Show success message
            alert('Hikaye başarıyla indirildi!');
        }, 'image/png');
        
    } catch (error) {
        console.error('Error downloading story image:', error);
        alert('Hikaye indirilirken bir hata oluştu: ' + error.message);
    }
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchCarDetail();
    setupShareButton();
    setupInstagramStoryButton();
});


