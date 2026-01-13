// OTOADA Admin Dashboard
// Manages car listings from Supabase with sidebar filtering
// Uses Supabase Auth for authentication

// Helper function to transform Supabase data to match frontend format
function transformSupabaseCarForAdmin(car) {
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

// Global state
let allCars = []; // Store all fetched records
let currentFilter = 'pending'; // Current filter state
let currentEditRecordId = null; // Current record being edited
let allUsers = []; // Store all fetched users
let isUsersTabActive = false; // Track if users tab is active
let currentUserFilter = 'all'; // Current user filter: 'all' or 'ambassador'

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check Supabase Auth session
    if (!supabase) {
        console.error('Supabase client not initialized');
        showLogin();
        return;
    }
    
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Error checking session:', error);
            showLogin();
            return;
        }
        
        if (session) {
            // User is logged in
            showDashboard();
        } else {
            // No session, show login screen
            showLogin();
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        showLogin();
    }
    
    // Setup login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Login Handler (using Supabase Auth)
async function handleLogin(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('login-error');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Clear error
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
    
    // Check if Supabase client is available
    if (!supabase) {
        if (errorDiv) {
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = 'Supabase yapılandırması eksik.';
        }
        return;
    }
    
    try {
        // Sign in with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            throw error;
        }
        
        // Login successful
        emailInput.value = '';
        passwordInput.value = '';
        showDashboard();
        
    } catch (error) {
        console.error('Login error:', error);
        if (errorDiv) {
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = error.message || 'Giriş başarısız. Lütfen e-posta ve şifrenizi kontrol edin.';
        }
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Logout Handler (using Supabase Auth)
async function logout() {
    if (!supabase) {
        console.error('Supabase client not initialized');
        showLogin();
        return;
    }
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error);
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    // Clear local state
    allCars = [];
    currentFilter = 'pending';
    showLogin();
}

// Show Login Screen
function showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

// Show Dashboard
function showDashboard() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
    // If users tab is active, fetch users; otherwise fetch cars
    if (isUsersTabActive) {
        fetchUsers(currentUserFilter);
    } else {
        fetchAllCars();
    }
}

// Show Users Tab
function showUsersTab() {
    isUsersTabActive = true;
    currentUserFilter = 'all';
    
    // Update sidebar active state
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        btn.classList.add('bg-gray-700', 'text-gray-300');
    });
    const usersTab = document.getElementById('users-tab');
    if (usersTab) {
        usersTab.classList.remove('bg-gray-700', 'text-gray-300');
        usersTab.classList.add('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
    }
    
    // Hide cars container, show users section
    const carsContainer = document.getElementById('cars-container');
    const usersSection = document.getElementById('users-section');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');
    const header = document.querySelector('.bg-gray-800.border-b.border-gray-700.p-4');
    
    if (carsContainer) carsContainer.classList.add('hidden');
    if (loading) loading.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    
    if (header) {
        const title = header.querySelector('h2');
        const count = header.querySelector('p');
        if (title) title.textContent = '👥 Kullanıcılar';
        if (count) count.textContent = `${allUsers.length} kullanıcı`;
    }
    
    if (usersSection) {
        usersSection.style.display = 'block';
    }
    
    // Fetch users with 'all' filter
    filterUsers('all');
}

// Show Ambassadors Tab
function showAmbassadorsTab() {
    isUsersTabActive = true;
    currentUserFilter = 'ambassador';
    
    // Update sidebar active state
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        btn.classList.add('bg-gray-700', 'text-gray-300');
    });
    const ambassadorsTab = document.getElementById('ambassadors-tab');
    if (ambassadorsTab) {
        ambassadorsTab.classList.remove('bg-gray-700', 'text-gray-300');
        ambassadorsTab.classList.add('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
    }
    
    // Hide cars container, show users section
    const carsContainer = document.getElementById('cars-container');
    const usersSection = document.getElementById('users-section');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');
    const header = document.querySelector('.bg-gray-800.border-b.border-gray-700.p-4');
    
    if (carsContainer) carsContainer.classList.add('hidden');
    if (loading) loading.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    
    if (header) {
        const title = header.querySelector('h2');
        const count = header.querySelector('p');
        if (title) title.textContent = '🌟 Elçiler';
        if (count) count.textContent = `${allUsers.length} elçi`;
    }
    
    if (usersSection) {
        usersSection.style.display = 'block';
    }
    
    // Fetch users with 'ambassador' filter
    filterUsers('ambassador');
}

// Show Galleries Tab
function showGalleriesTab() {
    isUsersTabActive = true;
    currentUserFilter = 'gallery';
    
    // Update sidebar active state
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        btn.classList.add('bg-gray-700', 'text-gray-300');
    });
    const galleriesTab = document.getElementById('galleries-tab');
    if (galleriesTab) {
        galleriesTab.classList.remove('bg-gray-700', 'text-gray-300');
        galleriesTab.classList.add('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
    }
    
    // Hide cars container, show users section
    const carsContainer = document.getElementById('cars-container');
    const usersSection = document.getElementById('users-section');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');
    const header = document.querySelector('.bg-gray-800.border-b.border-gray-700.p-4');
    
    if (carsContainer) carsContainer.classList.add('hidden');
    if (loading) loading.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    
    if (header) {
        const title = header.querySelector('h2');
        const count = header.querySelector('p');
        if (title) title.textContent = '🏢 Galeriler';
        if (count) count.textContent = `${allUsers.length} galeri`;
    }
    
    if (usersSection) {
        usersSection.style.display = 'block';
    }
    
    // Fetch users with 'gallery' filter
    filterUsers('gallery');
}

// Filter Users by Type
async function filterUsers(type) {
    currentUserFilter = type;
    await fetchUsers(type);
}

// Fetch Users from profiles table
async function fetchUsers(filterType = 'all') {
    if (!supabase) {
        showError('Supabase yapılandırması eksik.');
        return;
    }

    showLoading();
    
    const usersTableBody = document.getElementById('users-table-body');
    const totalUsersCount = document.getElementById('total-users-count');
    
    try {
        // Build query based on filter type
        let query = supabase
            .from('profiles')
            .select('id, full_name, role, whatsapp, email, gallery_name');
        
        // Apply filter based on type
        if (filterType === 'ambassador') {
            query = query.eq('role', 'ambassador');
        } else if (filterType === 'gallery') {
            query = query.eq('role', 'gallery');
        }
        
        // Order by full_name
        query = query.order('full_name', { ascending: true });
        
        const { data, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        allUsers = data || [];
        hideLoading();

        // Make users section visible after hiding loading
        const usersSection = document.getElementById('users-section');
        if (usersSection) {
            usersSection.style.display = 'block';
        }

        // Update total users count
        if (totalUsersCount) {
            let countText = 'Kullanıcı';
            if (filterType === 'ambassador') {
                countText = 'Elçi';
            } else if (filterType === 'gallery') {
                countText = 'Galeri';
            }
            totalUsersCount.textContent = `${allUsers.length} ${countText}`;
        }

        // Render the table
        renderUsersTable(usersTableBody);

    } catch (error) {
        console.error('Error fetching users:', error);
        hideLoading();
        // Make users section visible even on error (so user can see the error state)
        const usersSection = document.getElementById('users-section');
        if (usersSection) {
            usersSection.style.display = 'block';
        }
        showError(error.message);
    }
}

// Render Users Table
function renderUsersTable(usersTableBody) {
    if (!usersTableBody) return;
    
    // Clear innerHTML before appending
    usersTableBody.innerHTML = '';
    
    if (allUsers.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    Henüz kullanıcı bulunmamaktadır.
                </td>
            </tr>
        `;
    } else {
        // Loop through users and create table rows
        const rowsHTML = allUsers.map(user => {
            // Role badge text mapping
            const roleText = user.role === 'member' ? 'Üye' : 
                            user.role === 'gallery' ? 'Galeri' : 
                            user.role === 'ambassador' ? 'Elçi' : user.role || 'Bilinmeyen';
            
            // Role badge color mapping (member=gray, gallery=blue, ambassador=purple)
            const roleBadgeColor = user.role === 'member' ? 'bg-gray-500' : 
                                  user.role === 'gallery' ? 'bg-blue-500' : 
                                  user.role === 'ambassador' ? 'bg-purple-500' : 'bg-gray-500';
            
            // Action buttons based on role
            let actionButtons = '';
            
            if (user.role === 'member' || user.role === 'gallery') {
                // Green button for promoting to ambassador
                actionButtons = `<button onclick="updateUserRole('${user.id}', 'ambassador')" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors duration-200">
                    Elçi Yap
                </button>`;
            } else if (user.role === 'ambassador') {
                // Red button for demoting to member
                actionButtons = `<button onclick="updateUserRole('${user.id}', 'member')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors duration-200">
                    Elçiliği Al
                </button>`;
            }
            
            // Format full name with gallery name if available
            let displayName = user.full_name || 'İsimsiz';
            if (user.gallery_name) {
                displayName = `${displayName} (${user.gallery_name})`;
            }
            
            return `
                <tr class="hover:bg-gray-700 transition-colors duration-200">
                    <td class="px-6 py-4 text-white">${displayName}</td>
                    <td class="px-6 py-4 text-gray-300">${user.email || '-'}</td>
                    <td class="px-6 py-4 text-gray-300">${user.whatsapp || '-'}</td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeColor} text-white">
                            ${roleText}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        ${actionButtons}
                    </td>
                </tr>
            `;
        }).join('');
        
        usersTableBody.innerHTML = rowsHTML;
    }
}

// Update User Role
async function updateUserRole(userId, newRole) {
    if (!supabase) {
        alert('Supabase yapılandırması eksik.');
        return;
    }

    const roleText = newRole === 'ambassador' ? 'Elçi' : 'Üye';
    const actionText = newRole === 'ambassador' ? 'Elçi yapmak' : 'Elçiliği almak';
    if (!confirm(`Kullanıcının rolünü ${actionText} istediğinize emin misiniz?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            throw new Error(error.message);
        }

        // Refresh users list with current filter
        await fetchUsers(currentUserFilter);
        
        // Show success message
        alert('Rol güncellendi!');

    } catch (error) {
        console.error('Error updating user role:', error);
        alert('Rol güncellenirken bir hata oluştu: ' + error.message);
    }
}

// Delete User
async function deleteUser(userId) {
    if (!supabase) {
        alert('Supabase yapılandırması eksik.');
        return;
    }

    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) {
            throw new Error(error.message);
        }

        // Refresh users list
        await fetchUsers();
        
        alert('Kullanıcı silindi!');

    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Kullanıcı silinirken bir hata oluştu: ' + error.message);
    }
}

// Fetch ALL Cars from Supabase (no filtering)
async function fetchAllCars() {
    // Check if Supabase client is configured
    if (!supabase) {
        // Try to initialize if not already done
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            showError('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
            return;
        }
    }
    
    // Show loading state
    showLoading();
    
    try {
        // Fetch ALL records with images join (explicit foreign key constraint: car_images_car_id_fkey)
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
            .order('created_at', { ascending: false });
        
        if (error) {
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        // Debug: Log raw data
        console.log('Supabase Data:', data);
        
        // Transform Supabase data to match frontend format
        allCars = (data || []).map(car => transformSupabaseCarForAdmin(car));
        
        console.log(`Total records fetched: ${allCars.length}`);
        
        // Hide loading
        hideLoading();
        
        // Apply current filter
        filterCars(currentFilter);
        
    } catch (error) {
        console.error('Error fetching cars:', error);
        showError(error.message);
    }
}

// Filter Cars by Status
function filterCars(filterType) {
    isUsersTabActive = false;
    currentFilter = filterType;
    currentUserFilter = 'all'; // Reset user filter when switching to cars
    
    // Hide users section, show cars container
    const usersSection = document.getElementById('users-section');
    const carsContainer = document.getElementById('cars-container');
    if (usersSection) usersSection.style.display = 'none';
    if (carsContainer) carsContainer.classList.remove('hidden');
    
    // Update sidebar active state
    updateSidebarActiveState(filterType);
    
    // Filter records based on type
    let filteredCars = [];
    
    switch (filterType) {
        case 'pending':
            filteredCars = allCars.filter(record => {
                const durum = record.fields?.['Durum'];
                return !durum || durum === '' || durum === 'Onay Bekliyor';
            });
            updateFilterTitle('⏳ Onay Bekleyenler');
            break;
            
        case 'published':
            filteredCars = allCars.filter(record => {
                return record.fields?.['Durum'] === 'Yayında';
            });
            updateFilterTitle('✅ Yayındakiler');
            break;
            
        case 'sold':
            filteredCars = allCars.filter(record => {
                return record.fields?.['Durum'] === 'Satıldı';
            });
            updateFilterTitle('💰 Satıldı');
            break;
            
        case 'rejected':
            filteredCars = allCars.filter(record => {
                return record.fields?.['Durum'] === 'Reddedildi';
            });
            updateFilterTitle('❌ Reddedilenler');
            break;
            
        case 'all':
            filteredCars = allCars;
            updateFilterTitle('📂 Tüm İlanlar');
            break;
    }
    
    // Update record count
    updateRecordCount(filteredCars.length);
    
    // Render filtered cars
    if (filteredCars.length === 0) {
        showEmptyState();
    } else {
        renderCars(filteredCars);
    }
}

// Update Sidebar Active State
function updateSidebarActiveState(activeFilter) {
    // Remove active class from all buttons (including users, ambassadors, and galleries tabs)
    const buttons = ['pending', 'published', 'sold', 'rejected', 'all'];
    buttons.forEach(btn => {
        const element = document.getElementById(`filter-${btn}`);
        if (element) {
            element.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
            element.classList.add('bg-gray-700', 'text-gray-300');
        }
    });
    
    // Remove active class from users tab
    const usersTab = document.getElementById('users-tab');
    if (usersTab) {
        usersTab.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        usersTab.classList.add('bg-gray-700', 'text-gray-300');
    }
    
    // Remove active class from ambassadors tab
    const ambassadorsTab = document.getElementById('ambassadors-tab');
    if (ambassadorsTab) {
        ambassadorsTab.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        ambassadorsTab.classList.add('bg-gray-700', 'text-gray-300');
    }
    
    // Remove active class from galleries tab
    const galleriesTab = document.getElementById('galleries-tab');
    if (galleriesTab) {
        galleriesTab.classList.remove('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
        galleriesTab.classList.add('bg-gray-700', 'text-gray-300');
    }
    
    // Add active class to current button
    const activeElement = document.getElementById(`filter-${activeFilter}`);
    if (activeElement) {
        activeElement.classList.remove('bg-gray-700', 'text-gray-300');
        activeElement.classList.add('bg-yellow-500', 'bg-opacity-20', 'text-yellow-400');
    }
}

// Update Filter Title
function updateFilterTitle(title) {
    const titleElement = document.getElementById('current-filter-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

// Update Record Count
function updateRecordCount(count) {
    const countElement = document.getElementById('record-count');
    if (countElement) {
        countElement.textContent = `${count} ilan`;
    }
}

// Show Loading State
function showLoading() {
    document.getElementById('loading')?.classList.remove('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('error-state')?.classList.add('hidden');
    document.getElementById('cars-container')?.classList.add('hidden');
    const usersSection = document.getElementById('users-section');
    if (usersSection) usersSection.style.display = 'none';
}

// Hide Loading State
function hideLoading() {
    document.getElementById('loading')?.classList.add('hidden');
}

// Show Empty State
function showEmptyState() {
    document.getElementById('empty-state')?.classList.remove('hidden');
    document.getElementById('error-state')?.classList.add('hidden');
    document.getElementById('cars-container')?.classList.add('hidden');
}

// Show Error State
function showError(message) {
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    
    if (errorState) errorState.classList.remove('hidden');
    if (errorMessage) errorMessage.textContent = message;
    
    document.getElementById('loading')?.classList.add('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('cars-container')?.classList.add('hidden');
}

// Render Cars with Context-Aware Buttons
function renderCars(records) {
    const container = document.getElementById('cars-container');
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.remove('hidden');
    
    records.forEach(record => {
        const fields = record.fields || {};
        const recordId = record.id;
        
        // Extract car data using EXACT Turkish field names
        const marka = fields['Marka'] || 'Bilinmiyor';
        const model = fields['Model'] || 'Bilinmiyor';
        const fiyat = fields['Fiyat'] || 0;
        const paraBirimi = fields['ParaBirimi'] || 'STG';
        const satici = fields['Satici'] || 'Bilinmiyor';
        const durum = fields['Durum'] || 'Onay Bekliyor';
        const resim = fields['Resim'] || [];
        
        // Get first image URL - check if Resim array exists and has items
        let imageUrl = '';
        if (Array.isArray(resim) && resim.length > 0 && resim[0] && resim[0].url) {
            imageUrl = resim[0].url;
        }
        
        // Format price
        const formattedPrice = fiyat ? `${parseFloat(fiyat).toLocaleString('tr-TR')} ${paraBirimi}` : 'Fiyat Yok';
        
        // Generate buttons based on current filter
        let actionButtons = '';
        
        if (currentFilter === 'pending') {
            // Onay Bekleyenler: Onayla + Reddet
            actionButtons = `
                <div class="flex gap-2">
                    <button 
                        onclick="approveCar('${recordId}')" 
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        ONAYLA
                    </button>
                    <button 
                        onclick="rejectCar('${recordId}')" 
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        REDDET
                    </button>
                </div>
            `;
        } else if (currentFilter === 'published') {
            // Yayındakiler: Düzenle + Satıldı Yap + Sil
            actionButtons = `
                <button 
                    onclick="openEditModal('${recordId}')" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2 mb-2"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    DÜZENLE
                </button>
                <div class="flex gap-2">
                    <button 
                        onclick="markAsSold('${recordId}')" 
                        class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        SATILDI YAP
                    </button>
                    <button 
                        onclick="deleteCar('${recordId}')" 
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        SİL
                    </button>
                </div>
            `;
        } else if (currentFilter === 'sold') {
            // Satıldı: Tekrar Yayına Al + Sil
            actionButtons = `
                <div class="flex gap-2">
                    <button 
                        onclick="republishCar('${recordId}')" 
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        TEKRAR YAYINA AL
                    </button>
                    <button 
                        onclick="deleteCar('${recordId}')" 
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        SİL
                    </button>
                </div>
            `;
        } else {
            // Rejected / All: Show basic actions (Edit + Approve)
            actionButtons = `
                <button 
                    onclick="openEditModal('${recordId}')" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-colors duration-200 flex items-center justify-center gap-2 mb-2"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    DÜZENLE
                </button>
            `;
        }
        
        // Create card element
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700';
        card.dataset.recordId = recordId;
        
        card.innerHTML = `
            <!-- Image (Clickable) -->
            <a href="detail.html?id=${recordId}" target="_blank" class="relative w-full h-48 bg-gray-700 overflow-hidden block cursor-pointer hover:opacity-90 transition-opacity">
                ${imageUrl ? 
                    `<img src="${imageUrl}" alt="${marka} ${model}" class="w-full h-full object-cover">` : 
                    `<div class="w-full h-full flex items-center justify-center text-gray-500 text-lg">Resim Yok</div>`
                }
                <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    Önizle
                </div>
            </a>
            
            <!-- Content -->
            <div class="p-4 space-y-3">
                <!-- Title -->
                <div>
                    <h3 class="text-xl font-bold text-white">${marka} ${model}</h3>
                    <p class="text-yellow-400 font-semibold text-lg mt-1">${formattedPrice}</p>
                    <p class="text-gray-400 text-sm mt-1">Satıcı: ${satici}</p>
                    <p class="text-gray-500 text-xs mt-1">Durum: ${durum}</p>
                </div>
                
                <!-- Action Buttons -->
                <div class="space-y-2">
                    ${actionButtons}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Approve Car (Update Durum to 'Yayında')
async function approveCar(recordId) {
    if (!confirm('Bu ilanı onaylamak istediğinize emin misiniz?')) {
        return;
    }
    
    await updateCarStatus(recordId, 'Yayında');
}

// Reject Car (Update Durum to 'Reddedildi')
async function rejectCar(recordId) {
    if (!confirm('Bu ilanı reddetmek istediğinize emin misiniz?')) {
        return;
    }
    
    await updateCarStatus(recordId, 'Reddedildi');
}

// Mark Car as Sold (Update Durum to 'Satıldı')
async function markAsSold(recordId) {
    if (!confirm('Bu ilanı satıldı olarak işaretlemek istediğinize emin misiniz?')) {
        return;
    }
    
    await updateCarStatus(recordId, 'Satıldı');
}

// Republish Car (Update Durum to 'Yayında')
async function republishCar(recordId) {
    if (!confirm('Bu ilanı tekrar yayına almak istediğinize emin misiniz?')) {
        return;
    }
    
    await updateCarStatus(recordId, 'Yayında');
}

// Delete Car (Permanently delete from Supabase)
async function deleteCar(recordId) {
    if (!confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
        return;
    }
    
    // Check if Supabase client is configured
    if (!supabase) {
        alert('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
        return;
    }
    
    try {
        // First delete related images (due to foreign key constraint)
        const { error: imagesError } = await supabase
            .from('car_images')
            .delete()
            .eq('car_id', recordId);
        
        if (imagesError) {
            console.warn('Error deleting car images (may not exist):', imagesError);
        }
        
        // Then delete the car
        const { error } = await supabase
            .from('cars')
            .delete()
            .eq('id', recordId);
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Remove from local data
        allCars = allCars.filter(r => r.id !== recordId);
        
        // Refresh current filter view
        filterCars(currentFilter);
        
        alert('İlan başarıyla silindi!');
        
    } catch (error) {
        console.error('Error deleting car:', error);
        alert('Silme sırasında bir hata oluştu: ' + error.message);
    }
}

// Update Car Status
async function updateCarStatus(recordId, newStatus) {
    // Check if Supabase client is configured
    if (!supabase) {
        alert('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('cars')
            .update({ durum: newStatus })
            .eq('id', recordId);
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Update local data
        const recordIndex = allCars.findIndex(r => r.id === recordId);
        if (recordIndex !== -1) {
            allCars[recordIndex].fields['Durum'] = newStatus;
        }
        
        // Refresh current filter view
        filterCars(currentFilter);
        
    } catch (error) {
        console.error('Error updating car status:', error);
        alert('Güncelleme sırasında bir hata oluştu: ' + error.message);
    }
}

// Open Edit Modal
async function openEditModal(recordId) {
    currentEditRecordId = recordId;
    
    // Find record in local data first
    const record = allCars.find(r => r.id === recordId);
    if (record) {
        const fields = record.fields || {};
        
        // Populate form fields
        document.getElementById('edit-marka').value = fields['Marka'] || '';
        document.getElementById('edit-model').value = fields['Model'] || '';
        document.getElementById('edit-fiyat').value = fields['Fiyat'] || '';
        document.getElementById('edit-parabirimi').value = fields['ParaBirimi'] || 'STG';
        document.getElementById('edit-satici').value = fields['Satici'] || '';
        
        // Show modal
        const modal = document.getElementById('edit-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        return;
    }
    
    // Fallback: Fetch from Supabase if not in local data
    if (!supabase) {
        alert('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('cars')
            .select('*')
            .eq('id', recordId)
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Transform to frontend format
        const transformed = transformSupabaseCarForAdmin(data);
        const fields = transformed.fields || {};
        
        // Populate form fields
        document.getElementById('edit-marka').value = fields['Marka'] || '';
        document.getElementById('edit-model').value = fields['Model'] || '';
        document.getElementById('edit-fiyat').value = fields['Fiyat'] || '';
        document.getElementById('edit-parabirimi').value = fields['ParaBirimi'] || 'STG';
        document.getElementById('edit-satici').value = fields['Satici'] || '';
        
        // Show modal
        const modal = document.getElementById('edit-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        
    } catch (error) {
        console.error('Error fetching record for edit:', error);
        alert('İlan verisi yüklenirken bir hata oluştu: ' + error.message);
    }
}

// Close Edit Modal
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentEditRecordId = null;
}

// Save Car Edit
async function saveCarEdit(shouldPublish = false) {
    if (!currentEditRecordId) {
        alert('Düzenlenecek kayıt bulunamadı.');
        return;
    }
    
    // Get form values
    const marka = document.getElementById('edit-marka').value.trim();
    const model = document.getElementById('edit-model').value.trim();
    const fiyat = parseFloat(document.getElementById('edit-fiyat').value);
    const paraBirimi = document.getElementById('edit-parabirimi').value;
    const satici = document.getElementById('edit-satici').value.trim();
    
    // Validate
    if (!marka || !model || !satici || isNaN(fiyat) || fiyat <= 0) {
        alert('Lütfen tüm alanları doldurun ve geçerli bir fiyat girin.');
        return;
    }
    
    // Check if Supabase client is configured
    if (!supabase) {
        alert('Supabase yapılandırması eksik. Lütfen config.js dosyasını kontrol edin.');
        return;
    }
    
    // Prepare update data (map to Supabase column names)
    const updateData = {
        marka: marka,
        model: model,
        fiyat: fiyat,
        para_birimi: paraBirimi,
        satici: satici
    };
    
    // If shouldPublish, also update Durum
    if (shouldPublish) {
        updateData.durum = 'Yayında';
    }
    
    // Disable buttons during save
    const saveBtn = document.getElementById('edit-save-btn');
    const savePublishBtn = document.getElementById('edit-save-publish-btn');
    const originalSaveText = saveBtn?.textContent;
    const originalSavePublishText = savePublishBtn?.textContent;
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Kaydediliyor...';
    }
    if (savePublishBtn) {
        savePublishBtn.disabled = true;
        savePublishBtn.textContent = 'Kaydediliyor...';
    }
    
    try {
        const { error } = await supabase
            .from('cars')
            .update(updateData)
            .eq('id', currentEditRecordId);
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Update local data (transform back to frontend format)
        const recordIndex = allCars.findIndex(r => r.id === currentEditRecordId);
        if (recordIndex !== -1) {
            allCars[recordIndex].fields['Marka'] = marka;
            allCars[recordIndex].fields['Model'] = model;
            allCars[recordIndex].fields['Fiyat'] = fiyat;
            allCars[recordIndex].fields['ParaBirimi'] = paraBirimi;
            allCars[recordIndex].fields['Satici'] = satici;
            if (shouldPublish) {
                allCars[recordIndex].fields['Durum'] = 'Yayında';
            }
        }
        
        // Close modal
        closeEditModal();
        
        // Show success message
        if (shouldPublish) {
            alert('İlan başarıyla kaydedildi ve yayınlandı!');
        } else {
            alert('İlan başarıyla kaydedildi!');
        }
        
        // Refresh current filter view
        filterCars(currentFilter);
        
    } catch (error) {
        console.error('Error saving car edit:', error);
        alert('Kaydetme sırasında bir hata oluştu: ' + error.message);
    } finally {
        // Re-enable buttons
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalSaveText || 'Kaydet';
        }
        if (savePublishBtn) {
            savePublishBtn.disabled = false;
            savePublishBtn.textContent = originalSavePublishText || 'Kaydet ve Yayınla';
        }
    }
}
