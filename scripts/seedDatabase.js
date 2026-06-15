const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Artwork = require('../models/Artwork');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Auction = require('../models/Auction');
const Commission = require('../models/Commission');
const Collection = require('../models/Collection');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/artmarket', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Sample data
const sampleUsers = [
    {
        email: 'admin@artmarket.com',
        password: 'admin123',
        role: 'admin',
        profile: {
            firstName: 'Admin',
            lastName: 'User'
        }
    },
    {
        email: 'artist1@example.com',
        password: 'artist123',
        role: 'painter',
        profile: {
            firstName: 'Elena',
            lastName: 'Rodriguez'
        },
        painterProfile: {
            artistName: 'Elena Rodriguez Art',
            specialization: ['portrait', 'landscape'],
            yearsExperience: 15,
            bio: 'Contemporary artist specializing in portraits and landscapes',
            isVerified: true
        }
    },
    {
        email: 'artist2@example.com',
        password: 'artist123',
        role: 'painter',
        profile: {
            firstName: 'Marcus',
            lastName: 'Chen'
        },
        painterProfile: {
            artistName: 'Marcus Chen Studio',
            specialization: ['abstract', 'modern'],
            yearsExperience: 12,
            bio: 'Abstract expressionist exploring color and form',
            isVerified: true
        }
    },
    {
        email: 'customer1@example.com',
        password: 'customer123',
        role: 'customer',
        profile: {
            firstName: 'Sarah',
            lastName: 'Johnson'
        }
    },
    {
        email: 'customer2@example.com',
        password: 'customer123',
        role: 'customer',
        profile: {
            firstName: 'David',
            lastName: 'Williams'
        }
    }
];

const sampleArtworks = [
    {
        title: 'Sunset Serenity',
        description: 'A beautiful landscape capturing the golden hour',
        category: 'landscape',
        style: 'impressionism',
        medium: 'oil',
        dimensions: {
            width: 24,
            height: 18,
            unit: 'inch'
        },
        pricing: {
            originalPrice: 850,
            currency: 'USD'
        },
        yearCreated: 2024,
        tags: ['landscape', 'sunset', 'nature', 'oil painting'],
        colors: ['orange', 'yellow', 'blue', 'green']
    },
    {
        title: 'Urban Dreams',
        description: 'Abstract interpretation of city life',
        category: 'abstract',
        style: 'abstract',
        medium: 'acrylic',
        dimensions: {
            width: 36,
            height: 24,
            unit: 'inch'
        },
        pricing: {
            originalPrice: 1200,
            currency: 'USD'
        },
        yearCreated: 2024,
        tags: ['abstract', 'urban', 'modern', 'acrylic'],
        colors: ['red', 'black', 'white', 'gray']
    },
    {
        title: 'Portrait of Grace',
        description: 'Elegant portrait study in oil',
        category: 'portrait',
        style: 'realism',
        medium: 'oil',
        dimensions: {
            width: 16,
            height: 20,
            unit: 'inch'
        },
        pricing: {
            originalPrice: 1500,
            currency: 'USD'
        },
        yearCreated: 2024,
        tags: ['portrait', 'realism', 'oil', 'figure'],
        colors: ['brown', 'beige', 'red']
    },
    {
        title: 'Mountain Majesty',
        description: 'Majestic mountain landscape',
        category: 'landscape',
        style: 'realism',
        medium: 'watercolor',
        dimensions: {
            width: 20,
            height: 16,
            unit: 'inch'
        },
        pricing: {
            originalPrice: 650,
            currency: 'USD'
        },
        yearCreated: 2024,
        tags: ['landscape', 'mountain', 'watercolor', 'nature'],
        colors: ['blue', 'green', 'white', 'brown']
    },
    {
        title: 'Abstract Emotions',
        description: 'Exploration of human emotions through abstract forms',
        category: 'abstract',
        style: 'expressionism',
        medium: 'mixed-media',
        dimensions: {
            width: 30,
            height: 24,
            unit: 'inch'
        },
        pricing: {
            originalPrice: 950,
            currency: 'USD'
        },
        yearCreated: 2024,
        tags: ['abstract', 'expressionism', 'mixed-media', 'emotions'],
        colors: ['purple', 'orange', 'red', 'yellow']
    }
];

async function seedDatabase() {
    try {
        console.log('🌱 Seeding database...');

        // Clear existing data
        console.log('🧹 Clearing existing data...');
        await User.deleteMany({});
        await Artwork.deleteMany({});
        await Order.deleteMany({});
        await Review.deleteMany({});
        await Auction.deleteMany({});
        await Commission.deleteMany({});
        await Collection.deleteMany({});

        // Create users
        console.log('👥 Creating users...');
        const createdUsers = [];
        for (const userData of sampleUsers) {
            const user = new User(userData);
            await user.save();
            createdUsers.push(user);
            console.log(`✅ Created user: ${user.email}`);
        }

        // Create artworks
        console.log('🎨 Creating artworks...');
        const artists = createdUsers.filter(user => user.role === 'painter');
        const createdArtworks = [];
        
        for (let i = 0; i < sampleArtworks.length; i++) {
            const artworkData = sampleArtworks[i];
            const artist = artists[i % artists.length];
            
            const artwork = new Artwork({
                ...artworkData,
                artist: artist._id,
                isApproved: true,
                images: [
                    {
                        url: `https://picsum.photos/seed/${artworkData.title.replace(/\s+/g, '-')}/600/800`,
                        thumbnail: `https://picsum.photos/seed/${artworkData.title.replace(/\s+/g, '-')}/300/400`,
                        isPrimary: true
                    }
                ]
            });
            
            await artwork.save();
            createdArtworks.push(artwork);
            console.log(`✅ Created artwork: ${artwork.title}`);
        }

        // // Create sample orders
        // console.log('📦 Creating sample orders...');
        // const customers = createdUsers.filter(user => user.role === 'customer');
        
        // for (let i = 0; i < 3; i++) {
        //     const customer = customers[i % customers.length];
        //     const artwork = createdArtworks[i];
            
        //     const order = new Order({
        //         customer: customer._id,
        //         items: [{
        //             artwork: artwork._id,
        //             quantity: 1,
        //             price: artwork.pricing.originalPrice,
        //             artist: artwork.artist
        //         }],
        //         subtotal: artwork.pricing.originalPrice,
        //         shippingCost: 0,
        //         tax: artwork.pricing.originalPrice * 0.08,
        //         total: artwork.pricing.originalPrice * 1.08,
        //         shipping: {
        //             address: {
        //                 street: '123 Art Street',
        //                 city: 'New York',
        //                 state: 'NY',
        //                 zipCode: '10001',
        //                 country: 'USA'
        //             },
        //             method: 'Standard',
        //             cost: 0
        //         },
        //         payment: {
        //             method: 'stripe',
        //             transactionId: 'pi_test_' + Math.random().toString(36).substr(2, 9),
        //             amount: artwork.pricing.originalPrice * 1.08,
        //             currency: 'USD',
        //             status: 'completed'
        //         },
        //         status: 'delivered'
        //     });
            
        //     await order.save();
        //     console.log(`✅ Created order for customer: ${customer.email}`);
        // }
        // Create sample orders
console.log('📦 Creating sample orders...');
const customers = createdUsers.filter(user => user.role === 'customer');

for (let i = 0; i < 3; i++) {
    const customer = customers[i % customers.length];
    const artwork = createdArtworks[i];
    
    const order = new Order({
        orderNumber: `ORD-${Date.now()}-${i}`,  // ✅ ADDED
        customer: customer._id,
        items: [{
            artwork: artwork._id,
            quantity: 1,
            price: artwork.pricing.originalPrice,
            artist: artwork.artist
        }],
        subtotal: artwork.pricing.originalPrice,
        shippingCost: 0,
        tax: artwork.pricing.originalPrice * 0.08,
        total: artwork.pricing.originalPrice * 1.08,
        shipping: {
            address: {
                street: '123 Art Street',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                country: 'USA'
            },
            method: 'Standard',
            cost: 0
        },
        payment: {
            method: 'stripe',
            transactionId: 'pi_test_' + Math.random().toString(36).substr(2, 9),
            amount: artwork.pricing.originalPrice * 1.08,
            currency: 'USD',
            status: 'completed'
        },
        status: 'delivered',
        deliveredAt: new Date()  // ✅ ADDED (for delivered status)
    });
    
    await order.save();
    console.log(`✅ Created order for customer: ${customer.email}`);
}

        // // Create sample reviews
        // console.log('⭐ Creating sample reviews...');
        // for (let i = 0; i < 2; i++) {
        //     const artwork = createdArtworks[i];
        //     const customer = customers[i];
        //     const artist = artists.find(a => a._id.toString() === artwork.artist.toString());
            
        //     const review = new Review({
        //         order: null, // We'll link this later
        //         artwork: artwork._id,
        //         reviewer: customer._id,
        //         artist: artwork.artist,
        //         rating: 5,
        //         title: 'Absolutely beautiful!',
        //         comment: 'This artwork exceeded my expectations. The colors are vibrant and the craftsmanship is outstanding.',
        //         verifiedPurchase: true,
        //         isApproved: true
        //     });
            
        //     await review.save();
        //     console.log(`✅ Created review for artwork: ${artwork.title}`);
        // }
        // Create sample reviews
console.log('⭐ Creating sample reviews...');
const createdOrders = await Order.find({});  // ✅ FETCH CREATED ORDERS

for (let i = 0; i < Math.min(2, createdOrders.length); i++) {  // ✅ LIMIT TO AVAILABLE ORDERS
    const order = createdOrders[i];
    const artwork = createdArtworks[i];
    const customer = customers[i];
    
    const review = new Review({
        order: order._id,  // ✅ CHANGED FROM null TO order._id
        artwork: artwork._id,
        reviewer: customer._id,
        artist: artwork.artist,
        rating: 5,
        title: 'Absolutely beautiful!',
        comment: 'This artwork exceeded my expectations. The colors are vibrant and the craftsmanship is outstanding.',
        verifiedPurchase: true,
        isApproved: true
    });
    
    await review.save();
    console.log(`✅ Created review for artwork: ${artwork.title}`);
}

        console.log('🎉 Database seeding completed successfully!');
        console.log('📊 Summary:');
        console.log(`   Users: ${createdUsers.length}`);
        console.log(`   Artworks: ${createdArtworks.length}`);
        console.log(`   Artists: ${artists.length}`);
        console.log(`   Customers: ${customers.length}`);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

// Run the seeding
seedDatabase();