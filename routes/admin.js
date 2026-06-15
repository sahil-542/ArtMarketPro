const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artwork = require('../models/Artwork');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Commission = require('../models/Commission');
const Review = require('../models/Review');
const { auth, requireRole } = require('../middleware/auth');

// Get admin dashboard stats
router.get('/stats', auth, requireRole(['admin']), async (req, res) => {
    try {
        const stats = {};

        // User stats
        stats.totalUsers = await User.countDocuments();
        stats.activeUsers = await User.countDocuments({ isActive: true });
        stats.totalArtists = await User.countDocuments({ role: 'painter', isActive: true });
        stats.totalCustomers = await User.countDocuments({ role: 'customer', isActive: true });

        // Artwork stats
        stats.totalArtworks = await Artwork.countDocuments();
        stats.activeArtworks = await Artwork.countDocuments({ isActive: true, isApproved: true });
        stats.pendingArtworks = await Artwork.countDocuments({ isApproved: false });
        stats.soldArtworks = await Artwork.countDocuments({ availability: 'sold' });

        // Order stats
        stats.totalOrders = await Order.countDocuments();
        stats.pendingOrders = await Order.countDocuments({ status: 'pending' });
        stats.completedOrders = await Order.countDocuments({ status: 'delivered' });
        stats.totalRevenue = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Auction stats
        stats.activeAuctions = await Auction.countDocuments({ status: 'active' });
        stats.completedAuctions = await Auction.countDocuments({ status: 'ended' });

        // Commission stats
        stats.activeCommissions = await Commission.countDocuments({ status: { $in: ['in-progress', 'accepted'] } });
        stats.completedCommissions = await Commission.countDocuments({ status: 'delivered' });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admin stats', error: error.message });
    }
});

// Get all users (admin only)
router.get('/users', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search, status } = req.query;
        
        const filter = {};
        if (role) filter.role = role;
        if (status === 'active') filter.isActive = true;
        if (status === 'inactive') filter.isActive = false;
        if (search) {
            filter.$or = [
                { 'profile.firstName': { $regex: search, $options: 'i' } },
                { 'profile.lastName': { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await User.countDocuments(filter);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Update user status (admin only)
router.put('/users/:userId/status', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { isActive } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { isActive, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully`, user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user status', error: error.message });
    }
});

// Verify artist (admin only)
router.put('/artists/:userId/verify', auth, requireRole(['admin']), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { 
                'painterProfile.isVerified': true,
                updatedAt: Date.now()
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'painter') {
            return res.status(400).json({ message: 'User is not an artist' });
        }

        res.json({ message: 'Artist verified successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying artist', error: error.message });
    }
});

// Get pending artwork approvals
router.get('/artworks/pending', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const artworks = await Artwork.find({ isApproved: false })
            .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Artwork.countDocuments({ isApproved: false });

        res.json({
            artworks,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending artworks', error: error.message });
    }
});

// Approve/reject artwork (admin only)
router.put('/artworks/:artworkId/approve', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { approve, rejectionReason } = req.body;
        const artwork = await Artwork.findByIdAndUpdate(
            req.params.artworkId,
            { 
                isApproved: approve,
                rejectionReason: approve ? '' : rejectionReason,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        res.json({ 
            message: `Artwork ${approve ? 'approved' : 'rejected'} successfully`, 
            artwork 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating artwork approval', error: error.message });
    }
});

// Get platform analytics (admin only)
router.get('/analytics', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const days = parseInt(period.replace('d', ''));
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const analytics = {};

        // User growth
        analytics.userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Order analytics
        analytics.orderAnalytics = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Artwork uploads
        analytics.artworkUploads = await Artwork.aggregate([
            { $match: { createdAt: { $gte: startDate }, isApproved: true } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Top categories
        analytics.topCategories = await Artwork.aggregate([
            { $match: { isActive: true, isApproved: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Top artists by sales
        analytics.topArtists = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $unwind: '$items' },
            { $group: { _id: '$items.artist', totalSales: { $sum: '$items.price' }, orderCount: { $sum: 1 } } },
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'artist' } },
            { $unwind: '$artist' },
            { $project: { 'artist.painterProfile.artistName': 1, totalSales: 1, orderCount: 1 } }
        ]);

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching analytics', error: error.message });
    }
});

// Send notification to all users (admin only)
router.post('/notifications/broadcast', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { title, message, type, category, channels } = req.body;
        
        const users = await User.find({ isActive: true });
        const notifications = users.map(user => ({
            recipient: user._id,
            title,
            message,
            type: type || 'system',
            category: category || 'system',
            channels: channels || { inApp: true, email: false, push: false }
        }));

        const Notification = require('../models/Notification');
        await Notification.insertMany(notifications);

        res.json({ message: 'Broadcast notification sent successfully', count: notifications.length });
    } catch (error) {
        res.status(500).json({ message: 'Error sending broadcast notification', error: error.message });
    }
});

// Get platform settings (admin only)
router.get('/settings', auth, requireRole(['admin']), async (req, res) => {
    try {
        // In a real application, settings would be stored in a separate model
        const settings = {
            commissionRate: 0.15, // 15%
            featuredArtworkCost: 50, // $50 to feature artwork
            premiumMembershipCost: 29.99, // $29.99/month
            freeShippingThreshold: 100, // Free shipping over $100
            returnPeriod: 30, // 30 days
            auctionExtendTime: 300, // 5 minutes
            maxAuctionDuration: 168, // 7 days
            minAuctionDuration: 1 // 1 hour
        };

        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings', error: error.message });
    }
});

// Update platform settings (admin only)
router.put('/settings', auth, requireRole(['admin']), async (req, res) => {
    try {
        // In a real application, settings would be stored in a separate model
        const settings = req.body;
        
        // Validate and save settings
        // This is a placeholder - implement actual settings persistence

        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ message: 'Error updating settings', error: error.message });
    }
});

module.exports = router;