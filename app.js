const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (mock data for demo)
app.get('/api/artworks/featured', (req, res) => {
    res.json([
        {
            _id: '1',
            title: 'Sunset Serenity',
            description: 'A beautiful landscape capturing the golden hour',
            pricing: { originalPrice: 850, isOnSale: false },
            artist: {
                painterProfile: { artistName: 'Elena Rodriguez' }
            },
            images: [{ url: 'https://picsum.photos/seed/sunset/400/500' }]
        },
        {
            _id: '2',
            title: 'Urban Dreams',
            description: 'Abstract interpretation of city life',
            pricing: { originalPrice: 1200, isOnSale: true, salePrice: 960 },
            artist: {
                painterProfile: { artistName: 'Marcus Chen' }
            },
            images: [{ url: 'https://picsum.photos/seed/urban/400/500' }]
        },
        {
            _id: '3',
            title: 'Portrait of Grace',
            description: 'Elegant portrait study in oil',
            pricing: { originalPrice: 1500, isOnSale: false },
            artist: {
                painterProfile: { artistName: 'Elena Rodriguez' }
            },
            images: [{ url: 'https://picsum.photos/seed/portrait/400/500' }]
        }
    ]);
});

app.get('/api/users/trending', (req, res) => {
    res.json([
        {
            _id: '1',
            fullName: 'Elena Rodriguez',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Elena Rodriguez Art',
                specialization: ['portrait', 'landscape'],
                followers: ['1', '2', '3'],
                totalArtworks: 15
            }
        },
        {
            _id: '2',
            fullName: 'Marcus Chen',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Marcus Chen Studio',
                specialization: ['abstract', 'modern'],
                followers: ['1', '2'],
                totalArtworks: 12
            }
        },
        {
            _id: '3',
            fullName: 'Sarah Williams',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Sarah Williams Gallery',
                specialization: ['landscape', 'still-life'],
                followers: ['1', '2', '3', '4'],
                totalArtworks: 20
            }
        },
        {
            _id: '4',
            fullName: 'David Kim',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'David Kim Arts',
                specialization: ['abstract', 'contemporary'],
                followers: ['1', '2', '3'],
                totalArtworks: 8
            }
        }
    ]);
});

app.get('/api/auctions/live', (req, res) => {
    res.json([
        {
            _id: '1',
            title: 'Abstract Expression #42',
            description: 'Original abstract expressionist painting',
            currentBid: 450,
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            bids: [{}, {}],
            watchers: ['1', '2'],
            artwork: {
                images: [{ url: 'https://picsum.photos/seed/auction1/400/500' }]
            },
            artist: {
                painterProfile: { artistName: 'Marcus Chen' }
            }
        },
        {
            _id: '2',
            title: 'Sunset Landscape',
            description: 'Beautiful landscape painting',
            currentBid: 320,
            endTime: new Date(Date.now() + 45 * 60 * 1000),
            bids: [{}],
            watchers: ['1'],
            artwork: {
                images: [{ url: 'https://picsum.photos/seed/auction2/400/500' }]
            },
            artist: {
                painterProfile: { artistName: 'Elena Rodriguez' }
            }
        }
    ]);
});

app.get('/api/users/commission-artists', (req, res) => {
    res.json([
        {
            _id: '1',
            fullName: 'Elena Rodriguez',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Elena Rodriguez Art',
                specialization: ['portrait', 'landscape'],
                rating: 4.9,
                reviewCount: 23
            }
        },
        {
            _id: '2',
            fullName: 'Marcus Chen',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Marcus Chen Studio',
                specialization: ['abstract', 'modern'],
                rating: 4.8,
                reviewCount: 18
            }
        },
        {
            _id: '3',
            fullName: 'Sarah Williams',
            profile: { avatar: '' },
            painterProfile: { 
                artistName: 'Sarah Williams Gallery',
                specialization: ['landscape', 'still-life'],
                rating: 4.7,
                reviewCount: 31
            }
        }
    ]);
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 ArtMarket Pro server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
});