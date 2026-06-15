const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Artwork = require('../models/Artwork');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

// Get all public collections
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, featured } = req.query;
        
        let collections;
        if (featured === 'true') {
            collections = await Collection.findFeatured();
        } else {
            collections = await Collection.findPublic();
        }

        const total = await Collection.countDocuments({ isPublic: true });

        res.json({
            collections,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching collections', error: error.message });
    }
});

// Get user's collections
router.get('/my-collections', auth, async (req, res) => {
    try {
        const collections = await Collection.find({ curator: req.user._id })
            .populate('artworks.artwork', 'title images pricing')
            .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName')
            .sort({ createdAt: -1 })
            .exec();

        res.json(collections);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user collections', error: error.message });
    }
});

// Get single collection
router.get('/:id', async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id)
            .populate('artworks.artwork', 'title images pricing artist')
            .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName')
            .populate('followers', 'profile.firstName profile.lastName');

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if collection is public or user is the curator
        if (!collection.isPublic && (!req.user || collection.curator._id.toString() !== req.user._id.toString())) {
            return res.status(403).json({ message: 'Collection is private' });
        }

        res.json(collection);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching collection', error: error.message });
    }
});

// Create collection
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, tags, isPublic } = req.body;

        const collection = new Collection({
            name,
            description,
            curator: req.user._id,
            tags: tags || [],
            isPublic: isPublic || false
        });

        await collection.save();

        const populatedCollection = await Collection.findById(collection._id)
            .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName');

        res.status(201).json(populatedCollection);
    } catch (error) {
        res.status(500).json({ message: 'Error creating collection', error: error.message });
    }
});

// Update collection
router.put('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user is the curator
        if (collection.curator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this collection' });
        }

        const allowedUpdates = ['name', 'description', 'tags', 'isPublic', 'coverImage'];
        const updates = {};
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const updatedCollection = await Collection.findByIdAndUpdate(
            req.params.id,
            { ...updates, updatedAt: Date.now() },
            { new: true }
        ).populate('curator', 'profile.firstName profile.lastName painterProfile.artistName');

        res.json(updatedCollection);
    } catch (error) {
        res.status(500).json({ message: 'Error updating collection', error: error.message });
    }
});

// Delete collection
router.delete('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user is the curator
        if (collection.curator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this collection' });
        }

        await Collection.findByIdAndDelete(req.params.id);

        res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting collection', error: error.message });
    }
});

// Add artwork to collection
router.post('/:id/artworks', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user is the curator
        if (collection.curator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this collection' });
        }

        const { artworkId, note } = req.body;

        // Check if artwork exists
        const artwork = await Artwork.findById(artworkId);
        if (!artwork || !artwork.isActive) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        await collection.addArtwork(artworkId, note);

        res.json({ message: 'Artwork added to collection successfully', collection });
    } catch (error) {
        res.status(500).json({ message: 'Error adding artwork to collection', error: error.message });
    }
});

// Remove artwork from collection
router.delete('/:id/artworks/:artworkId', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user is the curator
        if (collection.curator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this collection' });
        }

        await collection.removeArtwork(req.params.artworkId);

        res.json({ message: 'Artwork removed from collection successfully', collection });
    } catch (error) {
        res.status(500).json({ message: 'Error removing artwork from collection', error: error.message });
    }
});

// Follow/unfollow collection
router.post('/:id/follow', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        if (!collection.isPublic) {
            return res.status(403).json({ message: 'Cannot follow private collection' });
        }

        await collection.toggleFollower(req.user._id);

        res.json({ 
            message: collection.followers.includes(req.user._id) ? 'Following collection' : 'Unfollowed collection',
            isFollowing: collection.followers.includes(req.user._id)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error following collection', error: error.message });
    }
});

// Get followed collections
router.get('/followed', auth, async (req, res) => {
    try {
        const collections = await Collection.find({
            followers: req.user._id,
            isPublic: true
        })
        .populate('artworks.artwork', 'title images pricing')
        .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName')
        .sort({ updatedAt: -1 })
        .exec();

        res.json(collections);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching followed collections', error: error.message });
    }
});

// Feature collection (admin only)
router.put('/:id/feature', auth, requireRole(['admin']), async (req, res) => {
    try {
        const collection = await Collection.findByIdAndUpdate(
            req.params.id,
            {
                'featured.isFeatured': true,
                'featured.featuredDate': new Date(),
                'featured.featuredBy': req.user._id
            },
            { new: true }
        );

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        res.json({ message: 'Collection featured successfully', collection });
    } catch (error) {
        res.status(500).json({ message: 'Error featuring collection', error: error.message });
    }
});

module.exports = router;