const express = require('express');
const router = express.Router();
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

// Get all artworks with filtering and pagination
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            style,
            medium,
            minPrice,
            maxPrice,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            artist,
            featured
        } = req.query;

        const filter = { isActive: true, isApproved: true };

        // Apply filters
        if (category) filter.category = category;
        if (style) filter.style = style;
        if (medium) filter.medium = medium;
        if (artist) filter.artist = artist;
        if (featured === 'true') filter['featured.isFeatured'] = true;

        // Price filtering
        if (minPrice || maxPrice) {
            filter['pricing.originalPrice'] = {};
            if (minPrice) filter['pricing.originalPrice'].$gte = parseFloat(minPrice);
            if (maxPrice) filter['pricing.originalPrice'].$lte = parseFloat(maxPrice);
        }

        // Search
        if (search) {
            filter.$text = { $search: search };
        }

        const artworks = await Artwork.find(filter)
            .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Artwork.countDocuments(filter);

        res.json({
            artworks,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artworks', error: error.message });
    }
});

// Get featured artworks
router.get('/featured', async (req, res) => {
    try {
        const artworks = await Artwork.find({
            isActive: true,
            isApproved: true,
            'featured.isFeatured': true
        })
        .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
        .sort({ 'featured.featuredDate': -1 })
        .limit(10)
        .exec();

        res.json(artworks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching featured artworks', error: error.message });
    }
});

// Get single artwork
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id)
            .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar painterProfile.bio')
            .populate('collections', 'name curator');

        if (!artwork || !artwork.isActive) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        // Increment view count
        artwork.stats.views += 1;
        await artwork.save();

        res.json(artwork);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artwork', error: error.message });
    }
});

// Create new artwork (artists only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'painter') {
            return res.status(403).json({ message: 'Only artists can create artworks' });
        }

        const artworkData = {
            ...req.body,
            artist: req.user._id
        };

        const artwork = new Artwork(artworkData);
        await artwork.save();

        // Update artist's artwork count
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'painterProfile.totalArtworks': 1 }
        });

        res.status(201).json(artwork);
    } catch (error) {
        res.status(500).json({ message: 'Error creating artwork', error: error.message });
    }
});

// Update artwork (artist only)
router.put('/:id', auth, async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id);
        
        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        if (artwork.artist.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this artwork' });
        }

        const updatedArtwork = await Artwork.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );

        res.json(updatedArtwork);
    } catch (error) {
        res.status(500).json({ message: 'Error updating artwork', error: error.message });
    }
});

// Delete artwork (artist only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id);
        
        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        if (artwork.artist.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this artwork' });
        }

        await Artwork.findByIdAndUpdate(req.params.id, { isActive: false });

        res.json({ message: 'Artwork deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting artwork', error: error.message });
    }
});

// Like/unlike artwork
router.post('/:id/like', auth, async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id);
        
        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        // This would typically be handled by a separate Like model
        artwork.stats.likes += 1;
        await artwork.save();

        res.json({ message: 'Artwork liked successfully', likes: artwork.stats.likes });
    } catch (error) {
        res.status(500).json({ message: 'Error liking artwork', error: error.message });
    }
});

// Get artworks by artist
router.get('/artist/:artistId', async (req, res) => {
    try {
        const artworks = await Artwork.find({
            artist: req.params.artistId,
            isActive: true,
            isApproved: true
        })
        .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName')
        .sort({ createdAt: -1 })
        .exec();

        res.json(artworks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artist artworks', error: error.message });
    }
});

// Search artworks
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const artworks = await Artwork.find(
            { 
                $text: { $search: query },
                isActive: true,
                isApproved: true
            },
            { score: { $meta: 'textScore' } }
        )
        .sort({ score: { $meta: 'textScore' } })
        .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

        res.json(artworks);
    } catch (error) {
        res.status(500).json({ message: 'Error searching artworks', error: error.message });
    }
});

module.exports = router;