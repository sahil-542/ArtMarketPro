const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artwork = require('../models/Artwork');
const { auth, requireRole } = require('../middleware/auth');

// Get user profile
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('-password')
            .populate('painterProfile.followers', 'profile.firstName profile.lastName')
            .populate('painterProfile.following', 'profile.firstName profile.lastName painterProfile.artistName');

        if (!user || !user.isActive) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's artworks if they're an artist
        let artworks = [];
        if (user.role === 'painter') {
            artworks = await Artwork.find({ 
                artist: user._id, 
                isActive: true, 
                isApproved: true 
            })
            .sort({ createdAt: -1 })
            .limit(12);
        }

        res.json({
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                painterProfile: user.painterProfile,
                preferences: user.preferences,
                wallet: user.wallet,
                membership: user.membership,
                fullName: user.fullName,
                followerCount: user.followerCount,
                followingCount: user.followingCount,
                artworks
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile', error: error.message });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const allowedUpdates = [
            'profile.firstName',
            'profile.lastName',
            'profile.bio',
            'profile.phone',
            'profile.address',
            'painterProfile.artistName',
            'painterProfile.specialization',
            'painterProfile.yearsExperience',
            'painterProfile.education',
            'painterProfile.exhibitions',
            'painterProfile.awards',
            'painterProfile.website',
            'painterProfile.socialLinks',
            'preferences'
        ];

        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key) || key.startsWith('profile.') || key.startsWith('painterProfile.') || key.startsWith('preferences.')) {
                updates[key] = req.body[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { ...updates, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
});

// Upload avatar
router.post('/avatar', auth, async (req, res) => {
    try {
        // In a real application, you would handle file upload here
        // using multer or similar middleware
        
        const { avatarUrl } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { 'profile.avatar': avatarUrl, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        res.json({ avatarUrl: user.profile.avatar });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading avatar', error: error.message });
    }
});

// Follow/unfollow user
router.post('/follow/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        if (userId === currentUserId.toString()) {
            return res.status(400).json({ message: 'Cannot follow yourself' });
        }

        const userToFollow = await User.findById(userId);
        const currentUser = await User.findById(currentUserId);

        if (!userToFollow || !userToFollow.isActive) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isAlreadyFollowing = currentUser.painterProfile.following.includes(userId);

        if (isAlreadyFollowing) {
            // Unfollow
            await User.findByIdAndUpdate(currentUserId, {
                $pull: { 'painterProfile.following': userId }
            });
            
            await User.findByIdAndUpdate(userId, {
                $pull: { 'painterProfile.followers': currentUserId }
            });

            res.json({ message: 'Unfollowed successfully', following: false });
        } else {
            // Follow
            await User.findByIdAndUpdate(currentUserId, {
                $addToSet: { 'painterProfile.following': userId }
            });
            
            await User.findByIdAndUpdate(userId, {
                $addToSet: { 'painterProfile.followers': currentUserId }
            });

            res.json({ message: 'Followed successfully', following: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error following user', error: error.message });
    }
});

// Get followers
router.get('/followers/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('painterProfile.followers', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
            .select('painterProfile.followers');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user.painterProfile.followers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching followers', error: error.message });
    }
});

// Get following
router.get('/following/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('painterProfile.following', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
            .select('painterProfile.following');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user.painterProfile.following);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching following', error: error.message });
    }
});

// Get trending artists
router.get('/trending', async (req, res) => {
    try {
        const { limit = 8 } = req.query;
        
        const artists = await User.find({
            role: 'painter',
            isActive: true,
            'painterProfile.isVerified': true
        })
        .select('profile painterProfile')
        .sort({ 
            'painterProfile.followers': -1, 
            'painterProfile.totalSales': -1,
            'painterProfile.rating': -1
        })
        .limit(parseInt(limit))
        .exec();

        res.json(artists);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching trending artists', error: error.message });
    }
});

// Get all artists with filtering
router.get('/artists', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            specialization,
            location,
            minRating,
            search
        } = req.query;

        const filter = { 
            role: 'painter', 
            isActive: true,
            'painterProfile.isVerified': true
        };

        if (specialization) {
            filter['painterProfile.specialization'] = { $in: [specialization] };
        }

        if (minRating) {
            filter['painterProfile.rating'] = { $gte: parseFloat(minRating) };
        }

        if (search) {
            filter.$or = [
                { 'profile.firstName': { $regex: search, $options: 'i' } },
                { 'profile.lastName': { $regex: search, $options: 'i' } },
                { 'painterProfile.artistName': { $regex: search, $options: 'i' } }
            ];
        }

        const artists = await User.find(filter)
            .select('profile painterProfile')
            .sort({ 'painterProfile.rating': -1, 'painterProfile.followers': -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await User.countDocuments(filter);

        res.json({
            artists,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artists', error: error.message });
    }
});

// Get artists available for commissions
router.get('/commission-artists', async (req, res) => {
    try {
        const { limit = 9 } = req.query;
        
        const artists = await User.find({
            role: 'painter',
            isActive: true,
            'painterProfile.isVerified': true,
            'painterProfile.specialization': { $exists: true, $ne: [] }
        })
        .select('profile painterProfile')
        .sort({ 'painterProfile.rating': -1, 'painterProfile.reviewCount': -1 })
        .limit(parseInt(limit))
        .exec();

        res.json(artists);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching commission artists', error: error.message });
    }
});

// Get user's dashboard data
router.get('/dashboard', auth, async (req, res) => {
    try {
        const user = req.user;
        const dashboardData = {};

        if (user.role === 'painter') {
            // Artist dashboard
            const artworks = await Artwork.find({ artist: user._id, isActive: true });
            const totalArtworks = artworks.length;
            const totalSales = user.painterProfile.totalSales;
            const followers = user.painterProfile.followers.length;
            const totalViews = artworks.reduce((sum, artwork) => sum + artwork.stats.views, 0);

            dashboardData.stats = {
                totalArtworks,
                totalSales,
                followers,
                totalViews
            };

            dashboardData.recentArtworks = artworks
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5);
        } else if (user.role === 'customer') {
            // Customer dashboard
            const Order = require('../models/Order');
            const orders = await Order.find({ customer: user._id });
            const totalOrders = orders.length;
            const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

            dashboardData.stats = {
                totalOrders,
                totalSpent,
                following: user.painterProfile?.following?.length || 0
            };
        }

        res.json(dashboardData);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
    }
});

module.exports = router;