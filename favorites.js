// Favorites Page - Display favorite cars from localStorage

// Favorites localStorage functions (same as airtable.js)
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

function toggleFavorite(carId, buttonElement) {
    const favorites = getFavorites();
    const index = favorites.indexOf(carId);
    
    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        buttonElement.classList.remove('active');
        
        // Remove card from display (the button is inside the card, and card is inside a div)
        const cardContainer = buttonElement.closest('.relative');
        if (cardContainer) {
            cardContainer.remove();
        }
        
        // Check if container is empty
        const container = document.getElementById('favorites-container');
        if (container && container.children.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-400 text-lg mb-2">Henüz favori ilanınız yok.</p>
                    <a href="index.html" class="text-yellow-500 hover:text-yellow-400 transition-colors">İlanları görüntüle</a>
                </div>
            `;
        }
    } else {
        // Add to favorites
        favorites.push(carId);
        buttonElement.classList.add('active');
    }
    
    saveFavorites(favorites);
    
    // Update icon visually
    const svg = buttonElement.querySelector('svg');
    if (svg) {
        if (favorites.includes(carId)) {
            svg.setAttribute('fill', '#ef4444');
            svg.setAttribute('class', 'w-6 h-6 text-red-500');
        } else {
            svg.setAttribute('fill', 'none');
            svg.setAttribute('class', 'w-6 h-6 text-white');
        }
    }
}

function updateFavoritesBadge() {
    const favorites = getFavorites();
    const count = favorites.length;
    
    const badge = document.getElementById('favorites-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Fetch favorite cars from Airtable
// Helper function to transform Supabase data to match frontend format
function transformSupabaseCarForFavorites(car) {
    // Get first image from car_images relationship
    let imageUrl = '';
    if (car.car_images && Array.isArray(car.car_images) && car.car_images.length > 0) {
        const sortedImages = car.car_images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        imageUrl = sortedImages[0].image_url || sortedImages[0].thumbnail_url || '';
    }
    
    // Transform to match frontend expected format (PascalCase field names like Airtable)
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
            // For images, create array format similar to Airtable
            Resim: imageUrl ? [{ url: imageUrl }] : []
        }
    };
}

async function fetchFavoriteCars() {
    const container = document.getElementById('favorites-container');
    if (!container) {
        console.error('Favorites container not found');
        return;
    }

    // Check if Supabase client is configured
    if (!supabase) {
        // Try to initialize if not already done
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.warn('Supabase client not configured. Please update config.js.');
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-red-400 mb-2">Supabase yapılandırması eksik.</p>
                    <p class="text-gray-500 text-sm">Lütfen config.js dosyasını kontrol edin.</p>
                </div>
            `;
            return;
        }
    }

    const favoriteIds = getFavorites();
    
    if (favoriteIds.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-gray-400 text-lg mb-2">Henüz favori ilanınız yok.</p>
                <a href="index.html" class="text-yellow-500 hover:text-yellow-400 transition-colors">İlanları görüntüle</a>
            </div>
        `;
        return;
    }
    
    try {
        // Fetch cars by IDs using Supabase 'in' filter (explicit foreign key constraint: car_images_car_id_fkey)
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
            .in('id', favoriteIds);

        if (error) {
            throw new Error(error.message);
        }

        // Transform Supabase data to match frontend format
        const records = (data || []).map(car => transformSupabaseCarForFavorites(car));

        if (records.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-400 text-lg mb-2">Henüz favori ilanınız yok.</p>
                    <a href="index.html" class="text-yellow-500 hover:text-yellow-400 transition-colors">İlanları görüntüle</a>
                </div>
            `;
            return;
        }

        // Render favorite car cards
        container.innerHTML = '';
        records.forEach(record => {
            const cardHTML = createCarCardHTML(record);
            container.insertAdjacentHTML('beforeend', cardHTML);
        });

    } catch (error) {
        console.error('Error fetching favorite cars from Supabase:', error);
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-red-400 mb-2">Favori ilanlar yüklenirken bir hata oluştu.</p>
                <p class="text-gray-500 text-sm">${error.message}</p>
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

    const formattedPrice = typeof fiyat === 'number' ? `£${fiyat.toLocaleString()}` : `£${fiyat}`;
    const formattedKM = km ? `${km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} KM` : '';

    // Build specs line
    const specsParts = [];
    if (vites) specsParts.push(vites);
    if (yakit) specsParts.push(yakit);
    const specsLine = specsParts.length > 0 ? specsParts.join(' • ') : '';

    // Check if this car is in favorites (should always be true here, but check anyway)
    const carIsFavorite = isFavorite(record.id);

    return `
        <div class="relative">
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
                    <div class="absolute top-3 right-3 bg-yellow-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-yellow-500/30">
                        <span class="text-xs font-semibold text-yellow-400">Premium</span>
                    </div>
                    <!-- Heart Icon -->
                    <button class="favorite-heart absolute top-3 left-3 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors ${carIsFavorite ? 'active' : ''}" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite('${record.id}', this)" data-car-id="${record.id}">
                        ${carIsFavorite 
                            ? `<svg class="w-6 h-6 text-red-500" fill="#ef4444" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>`
                            : `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>`
                        }
                    </button>
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
        </div>
    `;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateFavoritesBadge();
    fetchFavoriteCars();
});

