// ArtMarket Pro - Main Application
class ArtMarketApp {
    constructor() {
        this.currentUser = null;
        this.cart = JSON.parse(localStorage.getItem('artmarket-cart') || '[]');
        this.notifications = [];
        this.currentPage = 'home';
        this.socket = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.loadCurrentUser();
        this.updateCartUI();
        this.loadHomePage();
        this.setupSocketConnection();
    }
    
    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.navigateToPage(e.target.dataset.page);
            }
            
            if (e.target.matches('[data-action]')) {
                e.preventDefault();
                this.handleAction(e.target.dataset.action, e.target);
            }
            
            if (e.target.matches('[data-section]')) {
                e.preventDefault();
                this.showProfileSection(e.target.dataset.section);
            }
            
            if (e.target.matches('[data-tab]')) {
                e.preventDefault();
                this.switchTab(e.target.dataset.tab, e.target);
            }
        });
        
        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('mobileMenu').classList.add('open');
        });
        
        document.getElementById('closeMobileMenu').addEventListener('click', () => {
            document.getElementById('mobileMenu').classList.remove('open');
        });
        
        // User menu
        document.getElementById('userMenuBtn').addEventListener('click', () => {
            document.getElementById('userDropdown').classList.toggle('hidden');
        });
        
        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#userMenu')) {
                document.getElementById('userDropdown').classList.add('hidden');
            }
            
            if (!e.target.closest('#notificationPanel') && !e.target.closest('#notificationBtn')) {
                document.getElementById('notificationPanel').classList.add('hidden');
            }
        });
        
        // Modals
        this.setupModalListeners();
        
        // Forms
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });
        
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.debounce(() => this.handleSearch(e.target.value), 300)();
        });
        
        // Cart
        document.getElementById('cartBtn').addEventListener('click', () => {
            this.showCartModal();
        });
        
        // Notifications
        document.getElementById('notificationBtn').addEventListener('click', () => {
            this.toggleNotificationPanel();
        });
        
        // Filters
        this.setupFilterListeners();
    }
    
    setupModalListeners() {
        // Login/Register modal switching
        document.getElementById('showLoginModal').addEventListener('click', () => {
            this.hideModal('registerModal');
            this.showModal('loginModal');
        });
        
        document.getElementById('showRegisterModal').addEventListener('click', () => {
            this.hideModal('loginModal');
            this.showModal('registerModal');
        });
        
        // Close modals
        document.getElementById('closeLoginModal').addEventListener('click', () => {
            this.hideModal('loginModal');
        });
        
        document.getElementById('closeRegisterModal').addEventListener('click', () => {
            this.hideModal('registerModal');
        });
        
        document.getElementById('closeCartModal').addEventListener('click', () => {
            this.hideModal('cartModal');
        });
        
        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }
    
    setupFilterListeners() {
        // Filter chips
        document.addEventListener('click', (e) => {
            if (e.target.matches('.filter-chip')) {
                e.target.classList.toggle('active');
                this.applyFilters();
            }
        });
        
        // Select filters
        const filterSelects = ['categoryFilter', 'priceFilter', 'sortBy', 'specializationFilter', 'locationFilter'];
        filterSelects.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
            }
        });
    }
    
    initializeAnimations() {
        // Hero text animation
        if (document.getElementById('heroText')) {
            new Typed('#heroText', {
                strings: ['Artworks', 'Paintings', 'Masterpieces', 'Collections'],
                typeSpeed: 100,
                backSpeed: 50,
                backDelay: 2000,
                loop: true
            });
        }
        
        // Scroll animations
        this.setupScrollAnimations();
    }
    
    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, observerOptions);
        
        // Observe elements for animation
        document.querySelectorAll('.art-card, .artist-card, .auction-card').forEach(el => {
            observer.observe(el);
        });
    }
    
    setupSocketConnection() {
        // Initialize socket connection for real-time features
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            this.socket.on('message-received', (data) => {
                this.handleNewMessage(data);
            });
            
            this.socket.on('bid-update', (data) => {
                this.handleBidUpdate(data);
            });
            
            this.socket.on('notification', (data) => {
                this.addNotification(data);
            });
        }
    }
    // Add this new method after setupSocketConnection()
    switchTab(tabName, element) {
    // Remove active class from all tabs
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-600');
    });
    
    // Add active class to clicked tab
    if (element) {
        element.classList.add('active', 'border-blue-600', 'text-blue-600');
        element.classList.remove('border-transparent', 'text-gray-600');
    }
    
    // Hide all tab contents
    document.querySelectorAll('[data-tab-content]').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Show selected tab content
    const content = document.querySelector(`[data-tab-content="${tabName}"]`);
    if (content) {
        content.classList.remove('hidden');
    }
}
    
   navigateToPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    
    // Show selected page
    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
        this.currentPage = page;
        
        // Update navigation
        document.querySelectorAll('[data-page]').forEach(link => {
            link.classList.remove('active');
        });
        
        // ✅ FIX: Add null check
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Load page content
        this.loadPageContent(page);
    }
    
    // ✅ FIX: Add null check for mobile menu
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.remove('open');
    }
}
    loadPageContent(page) {
        switch (page) {
            case 'home':
                this.loadHomePage();
                break;
            case 'gallery':
                this.loadGalleryPage();
                break;
            case 'artists':
                this.loadArtistsPage();
                break;
            case 'auctions':
                this.loadAuctionsPage();
                break;
            case 'commissions':
                this.loadCommissionsPage();
                break;
        }
    }
    
    loadHomePage() {
        this.loadFeaturedArtworks();
        this.loadTrendingArtists();
        this.loadCategories();
        this.loadLiveAuctions();
    }
    
    async loadFeaturedArtworks() {
        try {
            const artworks = await this.apiRequest('/api/artworks/featured');
            const container = document.getElementById('featuredArtworksList');
            
            if (container && artworks.length > 0) {
                container.innerHTML = artworks.map(artwork => this.createArtworkCard(artwork)).join('');
                
                // Initialize Splide carousel
                new Splide('#featuredArtworks', {
                    type: 'loop',
                    perPage: 3,
                    perMove: 1,
                    gap: '2rem',
                    autoplay: true,
                    interval: 4000,
                    breakpoints: {
                        1024: { perPage: 2 },
                        768: { perPage: 1 }
                    }
                }).mount();
            }
        } catch (error) {
            console.error('Error loading featured artworks:', error);
        }
    }
    
    async loadTrendingArtists() {
        try {
            const artists = await this.apiRequest('/api/users/trending');
            const container = document.getElementById('trendingArtists');
            
            if (container && artists.length > 0) {
                container.innerHTML = artists.map(artist => this.createArtistCard(artist)).join('');
            }
        } catch (error) {
            console.error('Error loading trending artists:', error);
        }
    }
    
    loadCategories() {
        const categories = [
            { name: 'Abstract', icon: 'fas fa-shapes', count: 1250 },
            { name: 'Portrait', icon: 'fas fa-user', count: 890 },
            { name: 'Landscape', icon: 'fas fa-mountain', count: 1100 },
            { name: 'Still Life', icon: 'fas fa-apple-alt', count: 650 },
            { name: 'Modern', icon: 'fas fa-cube', count: 1400 },
            { name: 'Contemporary', icon: 'fas fa-paint-brush', count: 950 }
        ];
        
        const container = document.getElementById('categories');
        if (container) {
            container.innerHTML = categories.map(cat => `
                <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
                    <div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="${cat.icon} text-white text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold mb-1">${cat.name}</h3>
                    <p class="text-gray-600 text-sm">${cat.count} artworks</p>
                </div>
            `).join('');
        }
    }
    
    async loadLiveAuctions() {
        try {
            const auctions = await this.apiRequest('/api/auctions/live');
            const container = document.getElementById('liveAuctions');
            
            if (container && auctions.length > 0) {
                container.innerHTML = auctions.map(auction => this.createAuctionCard(auction)).join('');
            }
        } catch (error) {
            console.error('Error loading live auctions:', error);
        }
    }
    
    // async loadGalleryPage() {
    //     try {
    //         const artworks = await this.apiRequest('/api/artworks');
    //         this.displayArtworks(artworks);
    //     } catch (error) {
    //         console.error('Error loading gallery:', error);
    //     }
    // }
    async loadGalleryPage() {
    try {
        const data = await this.apiRequest('/api/artworks');
        console.log('Gallery API Response:', data);
        
        // Handle different response formats
        const artworks = Array.isArray(data) ? data : (data.artworks || data.data || []);
        
        if (!Array.isArray(artworks)) {
            console.error('Invalid artworks data:', artworks);
            this.displayArtworks([]);
            return;
        }
        
        this.displayArtworks(artworks);
    } catch (error) {
        console.error('Error loading gallery:', error);
        this.displayArtworks([]);
    }
}
    
    // async loadArtistsPage() {
    //     try {
    //         const artists = await this.apiRequest('/api/users/artists');
    //         this.displayArtists(artists);
    //     } catch (error) {
    //         console.error('Error loading artists:', error);
    //     }
    // }
    async loadArtistsPage() {
    try {
        const data = await this.apiRequest('/api/users/artists');
        console.log('Artists API Response:', data);
        
        // Handle different response formats
        const artists = Array.isArray(data) ? data : (data.artists || data.users || data.data || []);
        
        if (!Array.isArray(artists)) {
            console.error('Invalid artists data:', artists);
            this.displayArtists([]);
            return;
        }
        
        this.displayArtists(artists);
    } catch (error) {
        console.error('Error loading artists:', error);
        this.displayArtists([]);
    }
}
    
    async loadAuctionsPage() {
    try {
        const data = await this.apiRequest('/api/auctions');
        console.log('Auctions API Response:', data);
        
        // Handle different response formats
        const auctions = Array.isArray(data) ? data : (data.auctions || data.data || []);
        
        if (!Array.isArray(auctions)) {
            console.error('Invalid auctions data:', auctions);
            this.displayAuctions([]);
            return;
        }
        
        this.displayAuctions(auctions);
    } catch (error) {
        console.error('Error loading auctions:', error);
        this.displayAuctions([]);
    }
}
    
    async loadCommissionsPage() {
        try {
            const artists = await this.apiRequest('/api/users/commission-artists');
            this.displayCommissionArtists(artists);
        } catch (error) {
            console.error('Error loading commission artists:', error);
        }
    }
    
    // displayArtworks(artworks) {
    //     const container = document.getElementById('artworksGrid');
    //     if (container) {
    //         container.innerHTML = artworks.map(artwork => this.createArtworkCard(artwork, true)).join('');
    //     }
    // }
    displayArtworks(artworks) {
    const container = document.getElementById('artworksGrid');
    if (container) {
        if (artworks.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center col-span-full py-8">No artworks found</p>';
            return;
        }
        container.innerHTML = artworks.map(artwork => this.createArtworkCard(artwork, true)).join('');
    }
}
    
    // displayArtists(artists) {
    //     const container = document.getElementById('artistsGrid');
    //     if (container) {
    //         container.innerHTML = artists.map(artist => this.createArtistCard(artist)).join('');
    //     }
    // }
    displayArtists(artists) {
    const container = document.getElementById('artistsGrid');
    if (container) {
        if (artists.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center col-span-full py-8">No artists found</p>';
            return;
        }
        container.innerHTML = artists.map(artist => this.createArtistCard(artist)).join('');
    }
}
    
    // displayAuctions(auctions) {
    //     const container = document.getElementById('auctionsContent');
    //     if (container) {
    //         container.innerHTML = auctions.map(auction => this.createAuctionCard(auction)).join('');
    //     }
    // }
    displayAuctions(auctions) {
    const container = document.getElementById('auctionsContent');
    if (container) {
        if (auctions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No active auctions</p>';
            return;
        }
        container.innerHTML = auctions.map(auction => this.createAuctionCard(auction)).join('');
    }
}
    
    displayCommissionArtists(artists) {
        const container = document.getElementById('commissionArtists');
        if (container) {
            container.innerHTML = artists.map(artist => this.createCommissionArtistCard(artist)).join('');
        }
    }
    
    createArtworkCard(artwork, isGallery = false) {
        const image = artwork.images && artwork.images[0] ? artwork.images[0].url : '/images/placeholder.jpg';
        const price = artwork.pricing.isOnSale ? artwork.pricing.salePrice : artwork.pricing.originalPrice;
        const discount = artwork.pricing.isOnSale ? 
            Math.round(((artwork.pricing.originalPrice - artwork.pricing.salePrice) / artwork.pricing.originalPrice) * 100) : 0;
        
        return `
            <div class="masonry-item art-card bg-white rounded-lg overflow-hidden shadow-sm">
                <div class="relative">
                    <img src="${image}" alt="${artwork.title}" class="w-full h-64 object-cover">
                    ${discount > 0 ? `<span class="price-tag absolute top-2 left-2 px-2 py-1 rounded text-xs">-${discount}%</span>` : ''}
                    <button class="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors" onclick="app.toggleFavorite('${artwork._id}')">
                        <i class="far fa-heart text-gray-600"></i>
                    </button>
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-lg mb-2">${artwork.title}</h3>
                    <p class="text-gray-600 text-sm mb-2">by ${artwork.artist?.painterProfile?.artistName || 'Unknown Artist'}</p>
                    <p class="text-gray-500 text-sm mb-3 line-clamp-2">${artwork.description}</p>
                    <div class="flex justify-between items-center">
                        <div class="flex flex-col">
                            ${discount > 0 ? `<span class="text-gray-400 line-through text-sm">$${artwork.pricing.originalPrice}</span>` : ''}
                            <span class="text-xl font-bold text-primary">$${price}</span>
                        </div>
                        <button class="btn-primary px-4 py-2 rounded-lg text-sm" onclick="app.addToCart('${artwork._id}')">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    createArtistCard(artist) {
        const avatar = artist.profile?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(artist.fullName || 'Artist') + '&background=3b82f6&color=fff&size=128';
        const followerCount = artist.painterProfile?.followers?.length || 0;
        const artworkCount = artist.painterProfile?.totalArtworks || 0;
        
        return `
            <div class="artist-card bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
                <div class="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden">
                    <img src="${avatar}" alt="${artist.fullName}" class="w-full h-full object-cover">
                </div>
                <h3 class="text-lg font-semibold mb-1">${artist.painterProfile?.artistName || artist.fullName}</h3>
                <p class="text-gray-600 text-sm mb-3">${artist.painterProfile?.specialization?.join(', ') || 'Artist'}</p>
                <div class="flex justify-center space-x-4 text-sm text-gray-500 mb-4">
                    <span>${followerCount} followers</span>
                    <span>${artworkCount} artworks</span>
                </div>
                <div class="flex space-x-2">
                    <button class="btn-primary flex-1 py-2 rounded-lg text-sm" onclick="app.followArtist('${artist._id}')">
                        Follow
                    </button>
                    <button class="border border-gray-300 flex-1 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors" onclick="app.viewArtistProfile('${artist._id}')">
                        View Profile
                    </button>
                </div>
            </div>
        `;
    }
    
    createAuctionCard(auction) {
        const timeRemaining = this.formatTimeRemaining(auction.endTime);
        const currentBid = auction.currentBid || auction.startingBid;
        const totalBids = auction.bids?.length || 0;
        
        return `
            <div class="auction-card bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div class="relative">
                    <img src="${auction.artwork?.images?.[0]?.url || '/images/placeholder.jpg'}" alt="${auction.title}" class="w-full h-48 object-cover">
                    <div class="auction-timer absolute top-2 right-2 px-2 py-1 rounded text-xs">
                        ${timeRemaining}
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-lg mb-2">${auction.title}</h3>
                    <p class="text-gray-600 text-sm mb-3">by ${auction.artist?.painterProfile?.artistName || 'Unknown Artist'}</p>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-sm text-gray-500">Current Bid</span>
                        <span class="text-xl font-bold text-primary">$${currentBid}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                        <span>${totalBids} bids</span>
                        <span>${auction.watchers?.length || 0} watchers</span>
                    </div>
                    <button class="btn-primary w-full py-2 rounded-lg" onclick="app.placeBid('${auction._id}')">
                        Place Bid
                    </button>
                </div>
            </div>
        `;
    }
    
    createCommissionArtistCard(artist) {
        const avatar = artist.profile?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(artist.fullName || 'Artist') + '&background=3b82f6&color=fff&size=128';
        const specialization = artist.painterProfile?.specialization?.join(', ') || 'Various styles';
        const rating = artist.painterProfile?.rating || 0;
        const reviewCount = artist.painterProfile?.reviewCount || 0;
        
        return `
            <div class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div class="flex items-center mb-4">
                    <div class="w-12 h-12 rounded-full overflow-hidden mr-4">
                        <img src="${avatar}" alt="${artist.fullName}" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <h3 class="font-semibold">${artist.painterProfile?.artistName || artist.fullName}</h3>
                        <p class="text-gray-600 text-sm">${specialization}</p>
                    </div>
                </div>
                <div class="flex items-center mb-4">
                    <div class="rating-stars mr-2">
                        ${this.generateStarRating(rating)}
                    </div>
                    <span class="text-gray-600 text-sm">(${reviewCount} reviews)</span>
                </div>
                <div class="text-sm text-gray-600 mb-4">
                    <p><strong>Starting from:</strong> $200</p>
                    <p><strong>Delivery:</strong> 2-4 weeks</p>
                </div>
                <button class="btn-primary w-full py-2 rounded-lg text-sm" onclick="app.requestCommission('${artist._id}')">
                    Request Commission
                </button>
            </div>
        `;
    }
    
    formatTimeRemaining(endTime) {
        const now = new Date();
        const end = new Date(endTime);
        const diff = end - now;
        
        if (diff <= 0) return 'Ended';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
    
    generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return '★'.repeat(fullStars) + 
               (hasHalfStar ? '☆' : '') + 
               '☆'.repeat(emptyStars);
    }
    
    handleAction(action, element) {
        switch (action) {
            case 'explore':
                this.navigateToPage('gallery');
                break;
            case 'become-artist':
                this.showModal('registerModal');
                break;
            case 'profile':
                this.navigateToPage('profile');
                break;
            case 'logout':
                this.handleLogout();
                break;
            default:
                this.showToast('Feature coming soon!', 'info');
        }
    }
    
    async handleLogin(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        try {
            this.showLoading();
            const response = await this.apiRequest('/api/auth/login', 'POST', data);
            
            if (response.token) {
                localStorage.setItem('artmarket-token', response.token);
                this.currentUser = response.user;
                this.updateUserUI();
                this.hideModal('loginModal');
                this.showToast('Login successful!', 'success');
            }
        } catch (error) {
            this.showToast(error.message || 'Login failed', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    // async handleRegister(form) {
    //     const formData = new FormData(form);
    //     const data = Object.fromEntries(formData);
        
    //     try {
    //         this.showLoading();
    //         const response = await this.apiRequest('/api/auth/register', 'POST', data);
            
    //         if (response.token) {
    //             localStorage.setItem('artmarket-token', response.token);
    //             this.currentUser = response.user;
    //             this.updateUserUI();
    //             this.hideModal('registerModal');
    //             this.showToast('Registration successful!', 'success');
    //         }
    //     } catch (error) {
    //         this.showToast(error.message || 'Registration failed', 'error');
    //     } finally {
    //         this.hideLoading();
    //     }
    // }
    async handleRegister(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // ✅ ADD: Log data to see what's being sent
    console.log('Registration data:', data);
    
    // ✅ ADD: Handle single 'name' field if exists
    if (data.name && !data.firstName) {
        const nameParts = data.name.trim().split(' ');
        data.firstName = nameParts[0] || '';
        data.lastName = nameParts.slice(1).join(' ') || '';
        delete data.name; // Remove 'name' field after splitting
    }
    
    try {
        this.showLoading();
        const response = await this.apiRequest('/api/auth/register', 'POST', data);
        
        if (response.token) {
            localStorage.setItem('artmarket-token', response.token);
            this.currentUser = response.user;
            this.updateUserUI();
            this.hideModal('registerModal');
            this.showToast('Registration successful!', 'success');
            
            // ✅ ADD: Redirect based on role
            if (response.user.role === 'artist' || response.user.role === 'painter') {
                this.navigateToPage('profile'); // or artist dashboard
            } else {
                this.navigateToPage('gallery');
            }
        }
    } catch (error) {
        // ✅ IMPROVED: Better error display
        console.error('Registration error:', error);
        this.showToast(error.message || 'Registration failed', 'error');
    } finally {
        this.hideLoading();
    }
}
    handleLogout() {
        localStorage.removeItem('artmarket-token');
        this.currentUser = null;
        this.updateUserUI();
        this.navigateToPage('home');
        this.showToast('Logged out successfully', 'success');
    }
    
    async loadCurrentUser() {
        const token = localStorage.getItem('artmarket-token');
        if (token) {
            try {
                const response = await this.apiRequest('/api/auth/me');
                this.currentUser = response.user;
                this.updateUserUI();
            } catch (error) {
                console.error('Error loading user:', error);
                localStorage.removeItem('artmarket-token');
            }
        }
    }
    
    updateUserUI() {
        const userNameElement = document.getElementById('userName');
        if (this.currentUser) {
            userNameElement.textContent = this.currentUser.fullName || this.currentUser.email;
        } else {
            userNameElement.textContent = 'Sign In';
        }
    }
    
    updateCartUI() {
        const cartCount = document.getElementById('cartCount');
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        
        localStorage.setItem('artmarket-cart', JSON.stringify(this.cart));
    }
    
    addToCart(artworkId) {
        const existingItem = this.cart.find(item => item.artworkId === artworkId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({ artworkId, quantity: 1 });
        }
        
        this.updateCartUI();
        this.showToast('Added to cart!', 'success');
    }
    
    showCartModal() {
        this.loadCartItems();
        this.showModal('cartModal');
    }
    
    loadCartItems() {
        const container = document.getElementById('cartItems');
        const totalElement = document.getElementById('cartTotal');
        
        if (this.cart.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty</p>';
            totalElement.textContent = '$0.00';
            return;
        }
        
        // In a real app, you would fetch artwork details from the API
        container.innerHTML = this.cart.map(item => `
            <div class="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                <div class="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <i class="fas fa-image text-gray-400"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold">Artwork ${item.artworkId}</h4>
                    <p class="text-gray-600 text-sm">Quantity: ${item.quantity}</p>
                </div>
                <div class="text-right">
                    <p class="font-semibold">$${item.quantity * 100}</p>
                    <button class="text-red-500 hover:text-red-700 text-sm" onclick="app.removeFromCart('${item.artworkId}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
        
        const total = this.cart.reduce((sum, item) => sum + (item.quantity * 100), 0);
        totalElement.textContent = `$${total.toFixed(2)}`;
    }
    
    removeFromCart(artworkId) {
        this.cart = this.cart.filter(item => item.artworkId !== artworkId);
        this.updateCartUI();
        this.loadCartItems();
    }
    
    toggleFavorite(artworkId) {
        // Toggle favorite status
        const button = event.target.closest('button');
        const icon = button.querySelector('i');
        
        if (icon.classList.contains('far')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            icon.classList.add('text-red-500');
            this.showToast('Added to favorites!', 'success');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            icon.classList.remove('text-red-500');
            this.showToast('Removed from favorites!', 'success');
        }
    }
    
    followArtist(artistId) {
        if (!this.currentUser) {
            this.showModal('loginModal');
            return;
        }
        
        // In a real app, this would make an API call
        this.showToast('Now following artist!', 'success');
    }
    
    viewArtistProfile(artistId) {
        // Navigate to artist profile page
        this.showToast('Artist profile coming soon!', 'info');
    }
    
    placeBid(auctionId) {
        if (!this.currentUser) {
            this.showModal('loginModal');
            return;
        }
        
        // Show bid modal or navigate to auction page
        this.showToast('Bid placement coming soon!', 'info');
    }
    
    requestCommission(artistId) {
        if (!this.currentUser) {
            this.showModal('loginModal');
            return;
        }
        
        // Navigate to commission request page
        this.showToast('Commission request coming soon!', 'info');
    }
    
    handleSearch(query) {
        // Implement search functionality
        console.log('Searching for:', query);
    }
    
    applyFilters() {
        // Implement filter functionality
        console.log('Applying filters');
    }
    
    toggleNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        panel.classList.toggle('hidden');
        
        if (!panel.classList.contains('hidden')) {
            this.loadNotifications();
        }
    }
    
    loadNotifications() {
        const container = document.getElementById('notificationList');
        
        if (this.notifications.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No notifications</p>';
            return;
        }
        
        container.innerHTML = this.notifications.map(notif => `
            <div class="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-bell text-white text-sm"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="font-medium text-sm">${notif.title}</h4>
                        <p class="text-gray-600 text-sm">${notif.message}</p>
                        <span class="text-gray-400 text-xs">${notif.time}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    addNotification(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationCount();
        
        // Show toast for new notification
        this.showToast(notification.title, 'info');
    }
    
    updateNotificationCount() {
        const countElement = document.getElementById('notificationCount');
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        countElement.textContent = unreadCount;
        countElement.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    
    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    
    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        toast.className = `toast slide-in p-4 rounded-lg mb-2 ${type}`;
        toast.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas fa-${this.getToastIcon(type)} text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-500"></i>
                <span class="font-medium">${message}</span>
                <button class="ml-auto text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    getToastIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }
    
    async apiRequest(endpoint, method = 'GET', data = null) {
        const token = localStorage.getItem('artmarket-token');
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(endpoint, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Request failed');
        }
        
        return result;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the application
const app = new ArtMarketApp();