const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get reviews for artwork
router.get('/artwork/:artworkId', async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'newest' } = req.query;
        
        const sortOptions = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            rating: { rating: -1 },
            helpful: { 'helpful.count': -1 }
        };

        const reviews = await Review.find({ 
            artwork: req.params.artworkId, 
            isApproved: true 
        })
        .populate('reviewer', 'profile.firstName profile.lastName')
        .populate('artist', 'painterProfile.artistName')
        .sort(sortOptions[sortBy] || sortOptions.newest)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

        const total = await Review.countDocuments({ artwork: req.params.artworkId, isApproved: true });
        const averageRating = await Review.getAverageRating(req.params.artworkId);

        res.json({
            reviews,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total,
            averageRating
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
});

// Get reviews for artist
router.get('/artist/:artistId', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const reviews = await Review.find({ 
            artist: req.params.artistId, 
            isApproved: true 
        })
        .populate('reviewer', 'profile.firstName profile.lastName')
        .populate('artwork', 'title images')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

        const total = await Review.countDocuments({ artist: req.params.artistId, isApproved: true });

        res.json({
            reviews,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artist reviews', error: error.message });
    }
});

// Get single review
router.get('/:id', async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('reviewer', 'profile.firstName profile.lastName')
            .populate('artist', 'painterProfile.artistName')
            .populate('artwork', 'title images');

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.json(review);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching review', error: error.message });
    }
});

// Create review
router.post('/', auth, async (req, res) => {
    try {
        const { orderId, artworkId, rating, title, comment, images } = req.body;

        // Verify order exists and belongs to user
        const order = await Order.findById(orderId);
        if (!order || order.customer.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Order not found or not authorized' });
        }

        // Check if order is delivered
        if (order.status !== 'delivered') {
            return res.status(400).json({ message: 'Can only review delivered orders' });
        }

        // Check if user has already reviewed this artwork from this order
        const existingReview = await Review.findOne({
            order: orderId,
            reviewer: req.user._id
        });

        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this order' });
        }

        // Get artwork and artist details
        const artwork = await Artwork.findById(artworkId);
        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        const review = new Review({
            order: orderId,
            artwork: artworkId,
            reviewer: req.user._id,
            artist: artwork.artist,
            rating: parseInt(rating),
            title,
            comment,
            images: images || [],
            verifiedPurchase: true
        });

        await review.save();

        // Update order with review reference
        order.reviews.push(review._id);
        await order.save();

        // Update artist's rating
        await updateArtistRating(artwork.artist);

        const populatedReview = await Review.findById(review._id)
            .populate('reviewer', 'profile.firstName profile.lastName')
            .populate('artist', 'painterProfile.artistName')
            .populate('artwork', 'title images');

        res.status(201).json(populatedReview);
    } catch (error) {
        res.status(500).json({ message: 'Error creating review', error: error.message });
    }
});

// Update review
router.put('/:id', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Check if user is the reviewer
        if (review.reviewer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this review' });
        }

        const { rating, title, comment, images } = req.body;

        review.rating = rating !== undefined ? parseInt(rating) : review.rating;
        review.title = title || review.title;
        review.comment = comment || review.comment;
        review.images = images || review.images;
        review.updatedAt = new Date();

        await review.save();

        // Update artist's rating
        await updateArtistRating(review.artist);

        res.json(review);
    } catch (error) {
        res.status(500).json({ message: 'Error updating review', error: error.message });
    }
});

// Delete review
router.delete('/:id', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Check if user is the reviewer or admin
        const isReviewer = review.reviewer.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isReviewer && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to delete this review' });
        }

        await Review.findByIdAndDelete(req.params.id);

        // Update artist's rating
        await updateArtistRating(review.artist);

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting review', error: error.message });
    }
});

// Mark review as helpful
router.post('/:id/helpful', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        await review.markHelpful(req.user._id);

        res.json({ message: 'Review marked as helpful', helpfulCount: review.helpful.count });
    } catch (error) {
        res.status(500).json({ message: 'Error marking review as helpful', error: error.message });
    }
});

// Add artist response
router.post('/:id/response', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Check if user is the artist being reviewed
        if (review.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to respond to this review' });
        }

        const { comment } = req.body;

        await review.addArtistResponse(comment);

        res.json({ message: 'Response added successfully', review });
    } catch (error) {
        res.status(500).json({ message: 'Error adding response', error: error.message });
    }
});

// Flag review
router.post('/:id/flag', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        const { reason, description } = req.body;

        review.flags.push({
            reason,
            reportedBy: req.user._id,
            description,
            status: 'pending'
        });

        await review.save();

        res.json({ message: 'Review flagged successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error flagging review', error: error.message });
    }
});

// Approve/reject review (admin only)
router.put('/:id/approve', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can approve reviews' });
        }

        const { approve } = req.body;
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { isApproved: approve },
            { new: true }
        );

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Update artist's rating
        await updateArtistRating(review.artist);

        res.json({ 
            message: `Review ${approve ? 'approved' : 'rejected'} successfully`, 
            review 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating review approval', error: error.message });
    }
});

// Helper function to update artist rating
async function updateArtistRating(artistId) {
    try {
        const result = await Review.aggregate([
            { $match: { artist: artistId, isApproved: true } },
            { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const averageRating = result.length > 0 ? result[0].averageRating : 0;
        const reviewCount = result.length > 0 ? result[0].count : 0;

        await User.findByIdAndUpdate(artistId, {
            'painterProfile.rating': averageRating,
            'painterProfile.reviewCount': reviewCount
        });
    } catch (error) {
        console.error('Error updating artist rating:', error);
    }
}

module.exports = router;