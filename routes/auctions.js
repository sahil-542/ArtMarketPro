const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// Get all auctions with filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            category,
            artist,
            minPrice,
            maxPrice
        } = req.query;

        const filter = {};
        
        if (status) {
            filter.status = status;
        } else {
            // Default to active and scheduled auctions
            filter.status = { $in: ['active', 'scheduled'] };
        }

        if (category) filter.category = category;
        if (artist) filter.artist = artist;

        // Price filtering
        if (minPrice || maxPrice) {
            filter.startingBid = {};
            if (minPrice) filter.startingBid.$gte = parseFloat(minPrice);
            if (maxPrice) filter.startingBid.$lte = parseFloat(maxPrice);
        }

        const auctions = await Auction.find(filter)
            .populate('artwork', 'title images pricing')
            .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
            .populate('winningBid.bidder', 'profile.firstName profile.lastName')
            .sort({ startTime: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Auction.countDocuments(filter);

        res.json({
            auctions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching auctions', error: error.message });
    }
});

// Get live auctions
router.get('/live', async (req, res) => {
    try {
        const now = new Date();
        const auctions = await Auction.find({
            status: 'active',
            startTime: { $lte: now },
            endTime: { $gt: now }
        })
        .populate('artwork', 'title images pricing')
        .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName')
        .sort({ endTime: 1 })
        .limit(12)
        .exec();

        res.json(auctions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching live auctions', error: error.message });
    }
});

// Get single auction
router.get('/:id', async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate('artwork', 'title images description pricing dimensions')
            .populate('artist', 'profile.firstName profile.lastName painterProfile.artistName painterProfile.avatar')
            .populate('bids.bidder', 'profile.firstName profile.lastName')
            .populate('winningBid.bidder', 'profile.firstName profile.lastName')
            .populate('watchers', 'profile.firstName profile.lastName');

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        res.json(auction);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching auction', error: error.message });
    }
});

// Create auction (artists only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'painter') {
            return res.status(403).json({ message: 'Only artists can create auctions' });
        }

        const {
            artworkId,
            title,
            description,
            startingBid,
            reservePrice,
            duration,
            bidIncrement = 5
        } = req.body;

        // Verify artwork belongs to artist
        const artwork = await Artwork.findById(artworkId);
        if (!artwork || artwork.artist.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to auction this artwork' });
        }

        if (artwork.availability !== 'available') {
            return res.status(400).json({ message: 'Artwork is not available for auction' });
        }

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

        const auction = new Auction({
            artwork: artworkId,
            artist: req.user._id,
            title,
            description,
            startingBid: parseFloat(startingBid),
            reservePrice: reservePrice ? parseFloat(reservePrice) : null,
            currentBid: parseFloat(startingBid),
            bidIncrement: parseFloat(bidIncrement),
            startTime,
            endTime,
            duration: parseFloat(duration),
            status: 'active'
        });

        await auction.save();

        // Update artwork status
        artwork.availability = 'reserved';
        await artwork.save();

        const populatedAuction = await Auction.findById(auction._id)
            .populate('artwork', 'title images')
            .populate('artist', 'painterProfile.artistName');

        res.status(201).json(populatedAuction);
    } catch (error) {
        res.status(500).json({ message: 'Error creating auction', error: error.message });
    }
});

// Place bid
router.post('/:id/bid', auth, async (req, res) => {
    try {
        const { amount } = req.body;
        const auction = await Auction.findById(req.params.id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        if (auction.status !== 'active') {
            return res.status(400).json({ message: 'Auction is not active' });
        }

        if (new Date() > auction.endTime) {
            return res.status(400).json({ message: 'Auction has ended' });
        }

        const bidAmount = parseFloat(amount);
        const minBid = auction.currentBid + auction.bidIncrement;

        if (bidAmount < minBid) {
            return res.status(400).json({ message: `Bid must be at least $${minBid}` });
        }

        // Add bid
        auction.bids.push({
            bidder: req.user._id,
            amount: bidAmount,
            timestamp: new Date()
        });

        auction.currentBid = bidAmount;

        // Handle auto-extend if enabled
        if (auction.settings.autoExtend && auction.settings.snipeProtection) {
            const timeRemaining = auction.endTime.getTime() - Date.now();
            if (timeRemaining < auction.settings.extendTime * 1000) {
                auction.endTime = new Date(Date.now() + auction.settings.extendTime * 1000);
            }
        }

        await auction.save();

        // Notify previous bidder they were outbid
        if (auction.bids.length > 1) {
            const previousBidder = auction.bids[auction.bids.length - 2].bidder;
            // Send notification to previous bidder
        }

        const populatedAuction = await Auction.findById(auction._id)
            .populate('bids.bidder', 'profile.firstName profile.lastName');

        res.json({
            message: 'Bid placed successfully',
            auction: populatedAuction
        });
    } catch (error) {
        res.status(500).json({ message: 'Error placing bid', error: error.message });
    }
});

// Watch/unwatch auction
router.post('/:id/watch', auth, async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        const isWatching = auction.watchers.includes(req.user._id);

        if (isWatching) {
            // Unwatch
            auction.watchers.pull(req.user._id);
            await auction.save();
            res.json({ message: 'Removed from watchlist', watching: false });
        } else {
            // Watch
            auction.watchers.push(req.user._id);
            await auction.save();
            res.json({ message: 'Added to watchlist', watching: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating watchlist', error: error.message });
    }
});

// End auction (artist or admin)
router.put('/:id/end', auth, async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        // Check authorization
        const isArtist = auction.artist.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to end this auction' });
        }

        await auction.endAuction();

        res.json({ message: 'Auction ended successfully', auction });
    } catch (error) {
        res.status(500).json({ message: 'Error ending auction', error: error.message });
    }
});

// Cancel auction (artist or admin)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        // Check authorization
        const isArtist = auction.artist.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to cancel this auction' });
        }

        auction.status = 'cancelled';
        await auction.save();

        // Restore artwork availability
        await Artwork.findByIdAndUpdate(auction.artwork, {
            availability: 'available'
        });

        res.json({ message: 'Auction cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling auction', error: error.message });
    }
});

// Get user's watched auctions
router.get('/watched', auth, async (req, res) => {
    try {
        const auctions = await Auction.find({
            watchers: req.user._id,
            status: { $in: ['active', 'scheduled'] }
        })
        .populate('artwork', 'title images')
        .populate('artist', 'painterProfile.artistName')
        .sort({ endTime: 1 })
        .exec();

        res.json(auctions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching watched auctions', error: error.message });
    }
});

// Get auctions ending soon
router.get('/ending-soon', async (req, res) => {
    try {
        const { minutes = 60 } = req.query;
        const auctions = await Auction.findEndingSoon(parseInt(minutes));
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ending soon auctions', error: error.message });
    }
});

module.exports = router;