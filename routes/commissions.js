const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// Create commission request
router.post('/', auth, async (req, res) => {
    try {
        const {
            title,
            description,
            artistId,
            category,
            style,
            medium,
            size,
            customDimensions,
            budget,
            timeline,
            specificRequirements,
            referenceImages
        } = req.body;

        // Verify artist exists and is active
        const artist = await User.findById(artistId);
        if (!artist || artist.role !== 'painter' || !artist.isActive) {
            return res.status(404).json({ message: 'Artist not found or not available' });
        }

        const commission = new Commission({
            title,
            description,
            customer: req.user._id,
            artist: artistId,
            category,
            style,
            medium,
            size,
            customDimensions,
            budget: {
                min: parseFloat(budget.min),
                max: parseFloat(budget.max),
                currency: budget.currency || 'USD'
            },
            timeline,
            specificRequirements,
            referenceImages: referenceImages || [],
            status: 'pending'
        });

        await commission.save();

        const populatedCommission = await Commission.findById(commission._id)
            .populate('customer', 'profile.firstName profile.lastName')
            .populate('artist', 'painterProfile.artistName');

        res.status(201).json(populatedCommission);
    } catch (error) {
        res.status(500).json({ message: 'Error creating commission', error: error.message });
    }
});

// Get user's commissions
router.get('/my-commissions', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const filter = {
            $or: [
                { customer: req.user._id },
                { artist: req.user._id }
            ]
        };
        
        if (status) filter.status = status;

        const commissions = await Commission.find(filter)
            .populate('customer', 'profile.firstName profile.lastName')
            .populate('artist', 'painterProfile.artistName painterProfile.avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Commission.countDocuments(filter);

        res.json({
            commissions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching commissions', error: error.message });
    }
});

// Get single commission
router.get('/:id', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id)
            .populate('customer', 'profile.firstName profile.lastName profile.email')
            .populate('artist', 'painterProfile.artistName painterProfile.avatar profile.email');

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check authorization
        const isCustomer = commission.customer._id.toString() === req.user._id.toString();
        const isArtist = commission.artist._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isCustomer && !isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this commission' });
        }

        res.json(commission);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching commission', error: error.message });
    }
});

// Send quote (artist only)
router.put('/:id/quote', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the artist
        if (commission.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to quote this commission' });
        }

        const { amount, deliveryTime, notes, validFor = 7 } = req.body;

        commission.quote = {
            amount: parseFloat(amount),
            currency: 'USD',
            deliveryTime,
            notes,
            validUntil: new Date(Date.now() + validFor * 24 * 60 * 60 * 1000)
        };

        commission.status = 'quoted';
        await commission.save();

        res.json({ message: 'Quote sent successfully', commission });
    } catch (error) {
        res.status(500).json({ message: 'Error sending quote', error: error.message });
    }
});

// Accept quote (customer only)
router.put('/:id/accept', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the customer
        if (commission.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to accept this commission' });
        }

        if (commission.status !== 'quoted') {
            return res.status(400).json({ message: 'Commission is not in quoted status' });
        }

        if (new Date() > commission.quote.validUntil) {
            return res.status(400).json({ message: 'Quote has expired' });
        }

        commission.status = 'accepted';
        commission.payment.totalAmount = commission.quote.amount;
        
        // Set up payment schedule based on quote
        if (commission.payment.paymentSchedule === '50-50') {
            commission.payment.milestonePayments = [
                {
                    amount: commission.quote.amount * 0.5,
                    description: 'Initial deposit',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    status: 'pending'
                },
                {
                    amount: commission.quote.amount * 0.5,
                    description: 'Final payment upon completion',
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'pending'
                }
            ];
        }

        await commission.save();

        res.json({ message: 'Quote accepted successfully', commission });
    } catch (error) {
        res.status(500).json({ message: 'Error accepting quote', error: error.message });
    }
});

// Add progress update (artist only)
router.post('/:id/progress', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the artist
        if (commission.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this commission' });
        }

        const { stage, description, images, percentage } = req.body;

        commission.progress.push({
            stage,
            description,
            images: images || [],
            percentage: percentage || 0,
            completed: false
        });

        commission.status = 'in-progress';
        await commission.save();

        res.json({ message: 'Progress update added successfully', commission });
    } catch (error) {
        res.status(500).json({ message: 'Error adding progress update', error: error.message });
    }
});

// Send message
router.post('/:id/message', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check authorization
        const isCustomer = commission.customer.toString() === req.user._id.toString();
        const isArtist = commission.artist.toString() === req.user._id.toString();

        if (!isCustomer && !isArtist) {
            return res.status(403).json({ message: 'Not authorized to message on this commission' });
        }

        const { message, images } = req.body;

        commission.sendMessage(req.user._id, message, images || []);
        await commission.save();

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
});

// Mark commission as completed (artist only)
router.put('/:id/complete', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the artist
        if (commission.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to complete this commission' });
        }

        commission.status = 'completed';
        await commission.save();

        res.json({ message: 'Commission marked as completed' });
    } catch (error) {
        res.status(500).json({ message: 'Error completing commission', error: error.message });
    }
});

// Submit final artwork (artist only)
router.put('/:id/final-artwork', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the artist
        if (commission.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to submit final artwork' });
        }

        const { images, deliveryMethod, deliveryAddress } = req.body;

        commission.finalArtwork = {
            images: images || [],
            deliveryMethod,
            deliveryAddress: deliveryAddress || commission.finalArtwork.deliveryAddress
        };

        commission.status = 'delivered';
        await commission.save();

        res.json({ message: 'Final artwork submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting final artwork', error: error.message });
    }
});

// Submit satisfaction feedback (customer only)
router.put('/:id/satisfaction', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check if user is the customer
        if (commission.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to submit feedback' });
        }

        const { rating, feedback, wouldRecommend } = req.body;

        commission.satisfaction = {
            rating: parseInt(rating),
            feedback,
            wouldRecommend: Boolean(wouldRecommend)
        };

        await commission.save();

        // Update artist's rating
        const artist = await User.findById(commission.artist);
        if (artist && artist.role === 'painter') {
            // This would typically recalculate the artist's overall rating
            // based on all their commission satisfaction ratings
        }

        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting feedback', error: error.message });
    }
});

// Cancel commission
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id);

        if (!commission) {
            return res.status(404).json({ message: 'Commission not found' });
        }

        // Check authorization
        const isCustomer = commission.customer.toString() === req.user._id.toString();
        const isArtist = commission.artist.toString() === req.user._id.toString();

        if (!isCustomer && !isArtist) {
            return res.status(403).json({ message: 'Not authorized to cancel this commission' });
        }

        // Check if commission can be cancelled
        if (!['pending', 'quoted', 'accepted'].includes(commission.status)) {
            return res.status(400).json({ message: 'Commission cannot be cancelled at this stage' });
        }

        commission.status = 'cancelled';
        await commission.save();

        res.json({ message: 'Commission cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling commission', error: error.message });
    }
});

module.exports = router;