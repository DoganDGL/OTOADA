// Airtable Integration
// Fetches car listings from Airtable and renders them

// Store all cars in a global variable for filtering
let allCars = [];

// Exchange rates for currency conversion (converting to STG)
// Fallback rates (used if API fails)
let EXCHANGE_RATES = {
    'TL': 0.024,  // Example: 1 TL = 0.024 STG (approx 42 TL = 1 STG)
    'EUR': 0.85,  // Example: 1 EUR = 0.85 STG
    'STG': 1      // Base currency
};

// Fetch real-time exchange rates from API
async function updateExchangeRates() {
    try {
        console.log('Fetching real-time exchange rates...');
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
        
        if (!response.ok) {
            throw new Error(`API response error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // API returns: 1 GBP = X TRY, 1 GBP = X EUR, etc.
        // We need: 1 TL = X STG, so: 1 TL = 1/TRY_STG STG
        // We need: 1 EUR = X STG, so: 1 EUR = 1/EUR_STG STG
        
        // Get last known rates from localStorage for comparison
        const lastRates = JSON.parse(localStorage.getItem('otoada_lastRates') || '{}');
        
        if (data.rates && data.rates.TRY) {
            // Convert TL to STG: 1 TL = (1 / TRY rate) STG
            EXCHANGE_RATES['TL'] = 1 / data.rates.TRY;
            console.log(`Updated TL rate: 1 TL = ${EXCHANGE_RATES['TL'].toFixed(6)} STG (from API: 1 GBP = ${data.rates.TRY} TRY)`);
            
            // Update ticker for STG/TL (shows 1 STG = X TL, which is data.rates.TRY)
            updateCurrencyTicker('tl', data.rates.TRY, lastRates.tl);
        }
        
        if (data.rates && data.rates.EUR) {
            // Convert EUR to STG: 1 EUR = (1 / EUR rate) STG
            EXCHANGE_RATES['EUR'] = 1 / data.rates.EUR;
            console.log(`Updated EUR rate: 1 EUR = ${EXCHANGE_RATES['EUR'].toFixed(6)} STG (from API: 1 GBP = ${data.rates.EUR} EUR)`);
            
            // Update ticker for STG/EUR (shows 1 STG = X EUR, which is data.rates.EUR)
            updateCurrencyTicker('eur', data.rates.EUR, lastRates.eur);
        }
        
        // STG remains 1 (base currency)
        EXCHANGE_RATES['STG'] = 1;
        
        // Save current rates to localStorage for next comparison
        localStorage.setItem('otoada_lastRates', JSON.stringify({
            tl: data.rates?.TRY || null,
            eur: data.rates?.EUR || null
        }));
        
        console.log('✅ Exchange rates updated successfully:', EXCHANGE_RATES);
        
    } catch (error) {
        console.warn('⚠️ Failed to fetch real-time exchange rates, using fallback rates:', error.message);
        console.log('Using fallback exchange rates:', EXCHANGE_RATES);
    }
}

// Update currency ticker display with trend indicator
function updateCurrencyTicker(currency, currentRate, lastRate) {
    const rateElement = document.getElementById(`rate-${currency}`);
    const trendElement = document.getElementById(`trend-${currency}`);
    
    if (!rateElement || !trendElement) {
        return; // Ticker elements not found (might not be on this page)
    }
    
    // Format rate to 2 decimal places
    rateElement.textContent = currentRate.toFixed(2);
    
    // Determine trend
    if (lastRate === null || lastRate === undefined) {
        // First visit or no previous rate
        trendElement.textContent = '-';
        trendElement.className = 'text-gray-400 text-xs';
    } else if (currentRate > lastRate) {
        // Rate increased (currency strengthened against STG)
        trendElement.textContent = '▲';
        trendElement.className = 'text-green-500 text-xs font-bold';
    } else if (currentRate < lastRate) {
        // Rate decreased (currency weakened against STG)
        trendElement.textContent = '▼';
        trendElement.className = 'text-red-500 text-xs font-bold';
    } else {
        // Rate unchanged
        trendElement.textContent = '-';
        trendElement.className = 'text-gray-400 text-xs';
    }
}

// Helper function to convert price to STG
function convertToSTG(price, currency) {
    // If currency is missing or invalid, assume STG
    const currencyKey = (currency || 'STG').toUpperCase();
    const rate = EXCHANGE_RATES[currencyKey] || 1; // Default to 1 if currency not found
    
    // Convert price to number if it's a string
    const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;
    
    // Convert to STG
    return priceNum * rate;
}

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

async function fetchCarsFromAirtable() {
    // Check if API key and Base ID are configured
    // Note: AIRTABLE_API_KEY and AIRTABLE_BASE_ID should be loaded from secrets.js
    if (typeof AIRTABLE_API_KEY === 'undefined' || typeof AIRTABLE_BASE_ID === 'undefined' || 
        !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || AIRTABLE_API_KEY === '' || AIRTABLE_BASE_ID === '') {
        console.warn('Airtable API Key or Base ID not configured. Please update secrets.js. Static car cards will be displayed.');
        return; // Keep static cards if API is not configured
    }

    const tableName = 'Table 1';
    // Clean URL - NO query parameters (no view, no sort, no filterByFormula)
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
    
    try {
        console.log('Fetching from Airtable (clean URL):', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Debug: Log total records fetched (before filtering)
        console.log('Total Records Fetched (before filtering):', data.records ? data.records.length : 0);
        
        // Filter: Client-side filtering - ONLY records where Durum === 'Yayında'
        let filteredRecords = (data.records || []).filter(record => {
            const fields = record.fields || {};
            return fields['Durum'] === 'Yayında';
        });
        
        // Sort: By createdTime (newest first)
        filteredRecords.sort((a, b) => {
            const timeA = new Date(a.createdTime || 0).getTime();
            const timeB = new Date(b.createdTime || 0).getTime();
            return timeB - timeA; // Newest first (descending)
        });
        
        console.log('Records after filtering (Durum === "Yayında"):', filteredRecords.length);
        console.log('Records after sorting (newest first):', filteredRecords.length);
        
        // Store filtered and sorted cars for further filtering
        allCars = filteredRecords;
        
        // Debug: Log filtered cars
        if (allCars.length > 0) {
            console.log('Filtered Cars (Yayında only):');
            allCars.forEach((record, index) => {
                const fields = record.fields || {};
                console.log(`Car ${index}:`, {
                    id: record.id,
                    createdTime: record.createdTime,
                    Marka: fields['Marka'] || 'N/A',
                    Model: fields['Model'] || 'N/A',
                    Durum: fields['Durum'] || 'N/A',
                    Fiyat: fields['Fiyat'] || 'N/A'
                });
            });
        } else {
            console.warn('No published records found (Durum === "Yayında")!');
        }
        
        // Initial render without additional filters
        filterCars();
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
        // Show error message to user
        const container = document.getElementById('car-cards-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-red-400 mb-2">Veri yüklenirken bir hata oluştu.</p>
                    <p class="text-gray-500 text-sm">${error.message}</p>
                </div>
            `;
        }
    }
}

function filterCars() {
    console.log('=== filterCars() called ===');
    console.log('Total cars in allCars array:', allCars.length);
    
    // Get filter values (check both desktop and mobile inputs, prefer desktop)
    const searchInput = document.getElementById('search-input');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const searchTerm = (searchInput?.value.trim() || mobileSearchInput?.value.trim() || '').toLowerCase();
    
    const brandFilter = document.getElementById('filter-brand')?.value || document.getElementById('mobile-filter-brand')?.value || '';
    const locationFilter = document.getElementById('filter-location')?.value || '';
    const fuelFilter = document.getElementById('filter-fuel')?.value || '';
    const gearFilter = document.getElementById('filter-gear')?.value || '';
    
    // Get currency selection (prefer desktop, fallback to mobile)
    const filterCurrency = document.getElementById('filter-currency')?.value || document.getElementById('mobile-filter-currency')?.value || 'STG';
    
    // Get price range inputs (prefer desktop, fallback to mobile, then slider)
    const priceMinInput = document.getElementById('price-min')?.value || document.getElementById('mobile-price-min')?.value || '';
    const priceMaxInput = document.getElementById('price-max')?.value || document.getElementById('mobile-price-max')?.value || '';
    const priceSlider = document.getElementById('price-slider')?.value || document.getElementById('mobile-price-slider')?.value || '200000';
    
    // Parse user's min/max inputs (if empty, use defaults)
    const userMinPrice = priceMinInput ? parseFloat(priceMinInput) : 0;
    const userMaxPrice = priceMaxInput ? parseFloat(priceMaxInput) : (parseInt(priceSlider) || 200000);
    
    // Convert user's input to STG using EXCHANGE_RATES
    // Use convertToSTG() function for consistency (it multiplies by rate)
    let minPriceSTG = 0;
    let maxPriceSTG = 200000;
    
    if (filterCurrency === 'STG') {
        // If user selected STG, use input values as is
        minPriceSTG = userMinPrice || 0;
        maxPriceSTG = userMaxPrice || 100000;
    } else {
        // Convert user's input from selected currency to STG
        // Use convertToSTG helper function (multiplies by rate)
        minPriceSTG = convertToSTG(userMinPrice || 0, filterCurrency);
        maxPriceSTG = convertToSTG(userMaxPrice || 100000, filterCurrency);
    }

    // Debug: Log active filters
    console.log('Active Filters:', {
        searchTerm: searchTerm || '(none)',
        brandFilter: brandFilter || '(none)',
        locationFilter: locationFilter || '(none)',
        fuelFilter: fuelFilter || '(none)',
        gearFilter: gearFilter || '(none)',
        filterCurrency: filterCurrency,
        userMinPrice: userMinPrice,
        userMaxPrice: userMaxPrice,
        minPriceSTG: minPriceSTG.toFixed(2),
        maxPriceSTG: maxPriceSTG.toFixed(2)
    });

    // Filter cars based on all criteria
    const filteredCars = allCars.filter((record, index) => {
        const fields = record.fields || {};
        
        // Extract field values
        const marka = (fields.Marka || fields.marka || '').toString();
        const model = (fields.Model || fields.model || '').toString();
        const aciklama = (fields.Aciklama || fields.aciklama || '').toString();
        const fiyat = fields.Fiyat || fields.fiyat || 0;
        const paraBirimi = fields.ParaBirimi || fields.paraBirimi || 'STG';
        const konum = fields.Konum || fields.konum || '';
        const yakit = fields.Yakit || fields.yakit || '';
        const vites = fields.Vites || fields.vites || '';
        const durum = fields.Durum || fields.durum || '';

        // Debug: Log processing each car
        console.log(`Processing Car ${index}:`, {
            id: record.id,
            Marka: marka || 'N/A',
            Model: model || 'N/A',
            Durum: durum || 'N/A',
            Fiyat: fiyat,
            Konum: konum || 'N/A',
            Yakit: yakit || 'N/A',
            Vites: vites || 'N/A'
        });

        // Search filter: Case-insensitive search on Brand, Model, or Description
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                marka.toLowerCase().includes(searchLower) ||
                model.toLowerCase().includes(searchLower) ||
                aciklama.toLowerCase().includes(searchLower);
            if (!matchesSearch) {
                console.log(`  ❌ Hidden because search mismatch: "${marka} ${model}" doesn't contain "${searchTerm}"`);
                return false;
            }
        }

        // Brand filter: Exact match (unless empty/All)
        if (brandFilter && marka !== brandFilter) {
            console.log(`  ❌ Hidden because brand mismatch: "${marka}" !== "${brandFilter}"`);
            return false;
        }

        // Price filter: Convert car's price to STG and compare against user's converted range
        const priceInSTG = convertToSTG(fiyat, paraBirimi);
        if (priceInSTG < minPriceSTG || priceInSTG > maxPriceSTG) {
            console.log(`  ❌ Hidden because price out of range: ${priceInSTG.toFixed(2)} STG (${fiyat} ${paraBirimi}) not between ${minPriceSTG.toFixed(2)} - ${maxPriceSTG.toFixed(2)} STG`);
            return false;
        }

        // Location filter: Exact match (unless empty/All)
        if (locationFilter && konum !== locationFilter) {
            console.log(`  ❌ Hidden because location mismatch: "${konum}" !== "${locationFilter}"`);
            return false;
        }

        // Fuel filter: Exact match (unless empty/All)
        if (fuelFilter && yakit !== fuelFilter) {
            console.log(`  ❌ Hidden because fuel mismatch: "${yakit}" !== "${fuelFilter}"`);
            return false;
        }

        // Gear filter: Exact match (unless empty/All)
        if (gearFilter && vites !== gearFilter) {
            console.log(`  ❌ Hidden because gear mismatch: "${vites}" !== "${gearFilter}"`);
            return false;
        }

        console.log(`  ✅ Car passed all filters: "${marka} ${model}"`);
        return true;
    });

    console.log(`Filtered Results: ${filteredCars.length} of ${allCars.length} cars`);
    console.log('=== End filterCars() ===');

    // Render filtered results
    renderCarCards(filteredCars);
}

function renderCarCards(records) {
    const container = document.getElementById('car-cards-container');
    
    if (!container) {
        console.error('Car cards container not found');
        return;
    }

    // Clear existing static cards
    container.innerHTML = '';

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-gray-400 text-lg mb-2">Sonuç bulunamadı</p>
                <p class="text-gray-500 text-sm">Filtre kriterlerinize uygun ilan bulunmamaktadır.</p>
            </div>
        `;
        return;
    }

    // Map Airtable fields to car card HTML
    // forEach starts at index 0 automatically - verified
    records.forEach((record, index) => {
        console.log(`Rendering Car Card ${index}:`, {
            id: record.id,
            Marka: record.fields?.Marka || record.fields?.marka || 'N/A',
            Model: record.fields?.Model || record.fields?.model || 'N/A',
            Durum: record.fields?.Durum || record.fields?.durum || 'N/A'
        });
        
        const fields = record.fields;
        
        // Extract field values (handle different possible field names)
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
        
        // Get first image URL if Resim is an array (Airtable attachment field)
        let imageUrl = '';
        if (Array.isArray(resim) && resim.length > 0) {
            imageUrl = resim[0].url || resim[0].thumbnails?.large?.url || '';
        } else if (typeof resim === 'string' && resim.trim() !== '') {
            imageUrl = resim;
        }

        // Format price with currency
        const formattedPrice = formatPrice(fiyat, paraBirimi);
        
        // Format KM
        const formattedKM = km ? `${km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} KM` : '';

        // Build specs line (Vites • Yakit)
        const specsParts = [];
        if (vites) specsParts.push(vites);
        if (yakit) specsParts.push(yakit);
        const specsLine = specsParts.length > 0 ? specsParts.join(' • ') : '';

        // Check if this car is in favorites
        const carIsFavorite = isFavorite(record.id);
        
        // Create car card HTML
        const cardHTML = `
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
                    
                    <!-- Seller Name -->
                    ${satici ? `
                    <p class="text-white font-bold mb-2">${satici}</p>
                    ` : ''}
                    
                    <!-- Location with icon -->
                    ${konum ? `
                    <div class="flex items-center gap-1.5 text-blue-400 mb-3">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="text-sm font-medium">${konum}</span>
                    </div>
                    ` : ''}
                    
                    <!-- Specs Line (Vites • Yakit) -->
                    ${specsLine ? `
                    <p class="text-sm text-gray-400 mb-4">${specsLine}</p>
                    ` : ''}
                    
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

        container.insertAdjacentHTML('beforeend', cardHTML);
    });
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

function toggleFavorite(carId, buttonElement) {
    const favorites = getFavorites();
    const index = favorites.indexOf(carId);
    
    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        buttonElement.classList.remove('active');
    } else {
        // Add to favorites
        favorites.push(carId);
        buttonElement.classList.add('active');
    }
    
    saveFavorites(favorites);
    
    // Update icon visually
    const svg = buttonElement.querySelector('svg');
    if (favorites.includes(carId)) {
        // Red filled heart
        svg.setAttribute('fill', '#ef4444');
        svg.setAttribute('class', 'w-6 h-6 text-red-500');
    } else {
        // Empty outline heart
        svg.setAttribute('fill', 'none');
        svg.setAttribute('class', 'w-6 h-6 text-white');
    }
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Update exchange rates first (use await to ensure rates are ready before filtering)
    await updateExchangeRates();
    
    updateFavoritesBadge();
    fetchCarsFromAirtable();
    
    // Add event listeners for all filter inputs
    const searchInput = document.getElementById('search-input');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const brandFilter = document.getElementById('filter-brand');
    const mobileBrandFilter = document.getElementById('mobile-filter-brand');
    const locationFilter = document.getElementById('filter-location');
    const fuelFilter = document.getElementById('filter-fuel');
    const gearFilter = document.getElementById('filter-gear');
    const priceSlider = document.getElementById('price-slider');
    const mobilePriceSlider = document.getElementById('mobile-price-slider');
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    const mobilePriceMin = document.getElementById('mobile-price-min');
    const mobilePriceMax = document.getElementById('mobile-price-max');
    const filterCurrency = document.getElementById('filter-currency');
    const mobileFilterCurrency = document.getElementById('mobile-filter-currency');

    // Search inputs - trigger on input (as user types)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (mobileSearchInput) mobileSearchInput.value = searchInput.value;
            filterCars();
        });
    }
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', () => {
            if (searchInput) searchInput.value = mobileSearchInput.value;
            filterCars();
        });
    }

    // Dropdown filters - trigger on change
    if (brandFilter) {
        brandFilter.addEventListener('change', () => {
            if (mobileBrandFilter) mobileBrandFilter.value = brandFilter.value;
            filterCars();
        });
    }
    if (mobileBrandFilter) {
        mobileBrandFilter.addEventListener('change', () => {
            if (brandFilter) brandFilter.value = mobileBrandFilter.value;
            filterCars();
        });
    }
    if (locationFilter) {
        locationFilter.addEventListener('change', filterCars);
    }
    if (fuelFilter) {
        fuelFilter.addEventListener('change', filterCars);
    }
    if (gearFilter) {
        gearFilter.addEventListener('change', filterCars);
    }

    // Helper function to update price display text
    function updatePriceDisplayText(value, displayElementId) {
        const display = document.getElementById(displayElementId);
        if (display) {
            const maxValue = 200000;
            let formatted;
            if (parseInt(value) >= maxValue) {
                formatted = 'Limit Yok';
            } else if (parseInt(value) >= 100000) {
                formatted = `£${parseInt(value).toLocaleString('tr-TR')}+`;
            } else {
                formatted = `£${parseInt(value).toLocaleString('tr-TR')}`;
            }
            display.textContent = formatted === 'Limit Yok' ? formatted : `Maks: ${formatted}`;
        }
    }
    
    // Helper function to show price controls buttons
    function showPriceControls() {
        const priceControls = document.getElementById('price-controls');
        if (priceControls) {
            priceControls.classList.remove('hidden');
        }
        const mobilePriceControls = document.getElementById('mobile-price-controls');
        if (mobilePriceControls) {
            mobilePriceControls.classList.remove('hidden');
        }
    }
    
    // Price sliders - Sync Slider -> Input: Update input value, display, and show buttons
    if (priceSlider) {
        priceSlider.addEventListener('input', () => {
            const sliderValue = priceSlider.value;
            
            // Sync to mobile slider
            if (mobilePriceSlider) mobilePriceSlider.value = sliderValue;
            
            // Sync to desktop max price input
            if (priceMax) {
                priceMax.value = sliderValue;
            }
            
            // Sync to mobile max price input
            if (mobilePriceMax) {
                mobilePriceMax.value = sliderValue;
            }
            
            // Update display text for both desktop and mobile
            updatePriceDisplayText(sliderValue, 'price-slider-value');
            updatePriceDisplayText(sliderValue, 'mobile-price-slider-value');
            
            // Show price controls buttons
            showPriceControls();
            
            // DO NOT filter yet - wait for "Uygula" click
        });
    }
    
    if (mobilePriceSlider) {
        mobilePriceSlider.addEventListener('input', () => {
            const sliderValue = mobilePriceSlider.value;
            
            // Sync to desktop slider
            if (priceSlider) priceSlider.value = sliderValue;
            
            // Sync to desktop max price input
            if (priceMax) {
                priceMax.value = sliderValue;
            }
            
            // Sync to mobile max price input
            if (mobilePriceMax) {
                mobilePriceMax.value = sliderValue;
            }
            
            // Update display text for both desktop and mobile
            updatePriceDisplayText(sliderValue, 'price-slider-value');
            updatePriceDisplayText(sliderValue, 'mobile-price-slider-value');
            
            // Show price controls buttons
            showPriceControls();
            
            // DO NOT filter yet - wait for "Uygula" click
        });
    }
    
    // Max Price Inputs - Sync Input -> Slider: Update slider value, display, and show buttons
    if (priceMax) {
        // Focus event: Clear "0" when user clicks inside input
        priceMax.addEventListener('focus', function() {
            if (this.value === '0' || this.value === '0') {
                this.value = '';
            }
        });
        
        // Blur event: Reset to "0" if input is empty when user clicks outside
        priceMax.addEventListener('blur', function() {
            if (this.value === '' || this.value === null || this.value === undefined) {
                this.value = '0';
                // Trigger sync after setting to 0
                this.dispatchEvent(new Event('input'));
            }
        });
        
        // Input event: Remove leading zeros and sync with slider
        priceMax.addEventListener('input', function() {
            // Remove leading zeros (e.g., "012000" -> "12000")
            if (this.value && this.value.length > 0 && this.value.startsWith('0') && this.value.length > 1) {
                const parsed = parseInt(this.value, 10);
                if (!isNaN(parsed)) {
                    this.value = parsed.toString();
                }
            }
            
            let inputValue = parseFloat(this.value);
            
            // Validate: ensure value is within range
            if (isNaN(inputValue) || inputValue < 0) {
                inputValue = 0;
                this.value = '0';
            } else if (inputValue > 200000) {
                inputValue = 200000;
                this.value = '200000';
            } else {
                // Ensure integer value (no decimals for price)
                inputValue = Math.round(inputValue);
                this.value = inputValue.toString();
            }
            
            // Sync to desktop slider
            if (priceSlider) {
                priceSlider.value = inputValue.toString();
            }
            
            // Sync to mobile slider
            if (mobilePriceSlider) {
                mobilePriceSlider.value = inputValue.toString();
            }
            
            // Sync to mobile max price input
            if (mobilePriceMax) {
                mobilePriceMax.value = inputValue.toString();
            }
            
            // Update display text for both desktop and mobile
            updatePriceDisplayText(inputValue.toString(), 'price-slider-value');
            updatePriceDisplayText(inputValue.toString(), 'mobile-price-slider-value');
            
            // Show price controls buttons
            showPriceControls();
            
            // DO NOT filter yet - wait for "Uygula" click
        });
    }
    
    if (mobilePriceMax) {
        // Focus event: Clear "0" when user clicks inside input
        mobilePriceMax.addEventListener('focus', function() {
            if (this.value === '0' || this.value === '0') {
                this.value = '';
            }
        });
        
        // Blur event: Reset to "0" if input is empty when user clicks outside
        mobilePriceMax.addEventListener('blur', function() {
            if (this.value === '' || this.value === null || this.value === undefined) {
                this.value = '0';
                // Trigger sync after setting to 0
                this.dispatchEvent(new Event('input'));
            }
        });
        
        // Input event: Remove leading zeros and sync with slider
        mobilePriceMax.addEventListener('input', function() {
            // Remove leading zeros (e.g., "012000" -> "12000")
            if (this.value && this.value.length > 0 && this.value.startsWith('0') && this.value.length > 1) {
                const parsed = parseInt(this.value, 10);
                if (!isNaN(parsed)) {
                    this.value = parsed.toString();
                }
            }
            
            let inputValue = parseFloat(this.value);
            
            // Validate: ensure value is within range
            if (isNaN(inputValue) || inputValue < 0) {
                inputValue = 0;
                this.value = '0';
            } else if (inputValue > 200000) {
                inputValue = 200000;
                this.value = '200000';
            } else {
                // Ensure integer value (no decimals for price)
                inputValue = Math.round(inputValue);
                this.value = inputValue.toString();
            }
            
            // Sync to desktop slider
            if (priceSlider) {
                priceSlider.value = inputValue.toString();
            }
            
            // Sync to mobile slider
            if (mobilePriceSlider) {
                mobilePriceSlider.value = inputValue.toString();
            }
            
            // Sync to desktop max price input
            if (priceMax) {
                priceMax.value = inputValue.toString();
            }
            
            // Update display text for both desktop and mobile
            updatePriceDisplayText(inputValue.toString(), 'price-slider-value');
            updatePriceDisplayText(inputValue.toString(), 'mobile-price-slider-value');
            
            // Show price controls buttons
            showPriceControls();
            
            // DO NOT filter yet - wait for "Uygula" click
        });
    }
    
    // Price Apply buttons - trigger filter on click
    const priceApplyBtn = document.getElementById('price-apply-btn');
    const mobilePriceApplyBtn = document.getElementById('mobile-price-apply-btn');
    
    if (priceApplyBtn) {
        priceApplyBtn.addEventListener('click', () => {
            filterCars();
        });
    }
    if (mobilePriceApplyBtn) {
        mobilePriceApplyBtn.addEventListener('click', () => {
            filterCars();
        });
    }
    
    // Initialize: Set sliders to max value and hide price controls on page load
    if (priceSlider) {
        priceSlider.value = '200000';
    }
    if (mobilePriceSlider) {
        mobilePriceSlider.value = '200000';
    }
    if (priceMax) priceMax.value = '200000';
    if (mobilePriceMax) mobilePriceMax.value = '200000';
    
    // Ensure price controls are hidden initially
    const priceControlsInit = document.getElementById('price-controls');
    const mobilePriceControlsInit = document.getElementById('mobile-price-controls');
    if (priceControlsInit) {
        priceControlsInit.classList.add('hidden');
    }
    if (mobilePriceControlsInit) {
        mobilePriceControlsInit.classList.add('hidden');
    }
    
    // Set display text to "Limit Yok" initially
    const priceSliderValueInit = document.getElementById('price-slider-value');
    const mobilePriceSliderValueInit = document.getElementById('mobile-price-slider-value');
    if (priceSliderValueInit) priceSliderValueInit.textContent = 'Limit Yok';
    if (mobilePriceSliderValueInit) mobilePriceSliderValueInit.textContent = 'Limit Yok';
    
    // Price Reset buttons - reset slider to max and show all cars
    const priceResetBtn = document.getElementById('price-reset-btn');
    const mobilePriceResetBtn = document.getElementById('mobile-price-reset-btn');
    
    if (priceResetBtn) {
        priceResetBtn.addEventListener('click', () => {
            // Reset slider to max
            if (priceSlider) priceSlider.value = '200000';
            if (mobilePriceSlider) mobilePriceSlider.value = '200000';
            
            // Reset price max input
            const priceMax = document.getElementById('price-max');
            const mobilePriceMax = document.getElementById('mobile-price-max');
            if (priceMax) priceMax.value = '200000';
            if (mobilePriceMax) mobilePriceMax.value = '200000';
            
            // Update display to "Limit Yok"
            const priceSliderValue = document.getElementById('price-slider-value');
            const mobilePriceSliderValue = document.getElementById('mobile-price-slider-value');
            if (priceSliderValue) priceSliderValue.textContent = 'Limit Yok';
            if (mobilePriceSliderValue) mobilePriceSliderValue.textContent = 'Limit Yok';
            
            // Hide price controls buttons
            const priceControls = document.getElementById('price-controls');
            if (priceControls) {
                priceControls.classList.add('hidden');
            }
            const mobilePriceControls = document.getElementById('mobile-price-controls');
            if (mobilePriceControls) {
                mobilePriceControls.classList.add('hidden');
            }
            
            // Filter to show all cars
            filterCars();
        });
    }
    if (mobilePriceResetBtn) {
        mobilePriceResetBtn.addEventListener('click', () => {
            // Reset slider to max
            if (priceSlider) priceSlider.value = '200000';
            if (mobilePriceSlider) mobilePriceSlider.value = '200000';
            
            // Reset price max input
            const priceMax = document.getElementById('price-max');
            const mobilePriceMax = document.getElementById('mobile-price-max');
            if (priceMax) priceMax.value = '200000';
            if (mobilePriceMax) mobilePriceMax.value = '200000';
            
            // Update display to "Limit Yok"
            const priceSliderValue = document.getElementById('price-slider-value');
            const mobilePriceSliderValue = document.getElementById('mobile-price-slider-value');
            if (priceSliderValue) priceSliderValue.textContent = 'Limit Yok';
            if (mobilePriceSliderValue) mobilePriceSliderValue.textContent = 'Limit Yok';
            
            // Hide price controls buttons
            const priceControls = document.getElementById('price-controls');
            if (priceControls) {
                priceControls.classList.add('hidden');
            }
            const mobilePriceControls = document.getElementById('mobile-price-controls');
            if (mobilePriceControls) {
                mobilePriceControls.classList.add('hidden');
            }
            
            // Filter to show all cars
            filterCars();
        });
    }
    
    // Price min inputs - sync between desktop and mobile (trigger filter immediately)
    if (priceMin) {
        priceMin.addEventListener('input', () => {
            if (mobilePriceMin) mobilePriceMin.value = priceMin.value;
            filterCars();
        });
    }
    if (mobilePriceMin) {
        mobilePriceMin.addEventListener('input', () => {
            if (priceMin) priceMin.value = mobilePriceMin.value;
            filterCars();
        });
    }
    // Note: Price max inputs (priceMax and mobilePriceMax) are already handled above with two-way slider synchronization
    
    // Currency select - trigger on change
    if (filterCurrency) {
        filterCurrency.addEventListener('change', () => {
            if (mobileFilterCurrency) mobileFilterCurrency.value = filterCurrency.value;
            filterCars();
        });
    }
    if (mobileFilterCurrency) {
        mobileFilterCurrency.addEventListener('change', () => {
            if (filterCurrency) filterCurrency.value = mobileFilterCurrency.value;
            filterCars();
        });
    }
});

