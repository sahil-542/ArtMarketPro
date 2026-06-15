const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// Create new order
router.post('/', auth, async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod } = req.body;
        
        // Validate items
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }

        // Calculate totals and validate artworks
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const artwork = await Artwork.findById(item.artworkId);
            
            if (!artwork || !artwork.isActive || artwork.availability !== 'available') {
                return res.status(400).json({ message: `Artwork ${item.artworkId} is not available` });
            }

            const price = artwork.pricing.isOnSale ? artwork.pricing.salePrice : artwork.pricing.originalPrice;
            subtotal += price * item.quantity;

            orderItems.push({
                artwork: artwork._id,
                quantity: item.quantity,
                price: price,
                artist: artwork.artist
            });
        }

        // Calculate shipping and tax
        const shippingCost = 0; // Free shipping for now
        const tax = subtotal * 0.08; // 8% tax
        const total = subtotal + shippingCost + tax;

        // Create order
        const order = new Order({
            customer: req.user._id,
            items: orderItems,
            subtotal,
            shippingCost,
            tax,
            total,
            shipping: {
                address: shippingAddress,
                method: 'Standard',
                cost: shippingCost
            },
            payment: {
                method: paymentMethod,
                amount: total,
                currency: 'USD',
                status: 'pending'
            },
            status: 'pending'
        });

        await order.save();

        // Update artwork availability
        for (const item of orderItems) {
            await Artwork.findByIdAndUpdate(item.artwork, {
                availability: 'sold',
                quantity: 0
            });
        }

        // Populate order with details
        const populatedOrder = await Order.findById(order._id)
            .populate('items.artwork', 'title images')
            .populate('items.artist', 'painterProfile.artistName');

        res.status(201).json(populatedOrder);
    } catch (error) {
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
});

// Get user's orders
router.get('/my-orders', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const filter = { customer: req.user._id };
        if (status) filter.status = status;

        const orders = await Order.find(filter)
            .populate('items.artwork', 'title images')
            .populate('items.artist', 'painterProfile.artistName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Get artist's orders
router.get('/artist-orders', auth, async (req, res) => {
    try {
        if (req.user.role !== 'painter') {
            return res.status(403).json({ message: 'Only artists can view their orders' });
        }

        const { page = 1, limit = 10, status } = req.query;
        
        const filter = { 'items.artist': req.user._id };
        if (status) filter.status = status;

        const orders = await Order.find(filter)
            .populate('customer', 'profile.firstName profile.lastName')
            .populate('items.artwork', 'title images')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching artist orders', error: error.message });
    }
});

// Get single order
router.get('/:orderId', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('customer', 'profile.firstName profile.lastName profile.email')
            .populate('items.artwork', 'title images pricing')
            .populate('items.artist', 'painterProfile.artistName profile.email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is authorized to view this order
        const isCustomer = order.customer._id.toString() === req.user._id.toString();
        const isArtist = order.items.some(item => item.artist._id.toString() === req.user._id.toString());
        const isAdmin = req.user.role === 'admin';

        if (!isCustomer && !isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
});

// Update order status
router.put('/:orderId/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check authorization
        const isArtist = order.items.some(item => item.artist._id.toString() === req.user._id.toString());
        const isAdmin = req.user.role === 'admin';

        if (!isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        order.status = status;
        await order.save();

        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
});

// Add tracking information
router.put('/:orderId/tracking', auth, async (req, res) => {
    try {
        const { trackingNumber, estimatedDelivery } = req.body;
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check authorization
        const isArtist = order.items.some(item => item.artist._id.toString() === req.user._id.toString());
        const isAdmin = req.user.role === 'admin';

        if (!isArtist && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        order.shipping.trackingNumber = trackingNumber;
        order.shipping.estimatedDelivery = new Date(estimatedDelivery);
        order.status = 'shipped';
        await order.save();

        res.json({ message: 'Tracking information added successfully', order });
    } catch (error) {
        res.status(500).json({ message: 'Error adding tracking information', error: error.message });
    }
});

// Cancel order
router.put('/:orderId/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is the customer
        if (order.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to cancel this order' });
        }

        // Check if order can be cancelled
        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
        }

        order.status = 'cancelled';
        await order.save();

        // Restore artwork availability
        for (const item of order.items) {
            await Artwork.findByIdAndUpdate(item.artwork, {
                availability: 'available',
                quantity: 1
            });
        }

        res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling order', error: error.message });
    }
});

// Request refund
router.post('/:orderId/refund', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is the customer
        if (order.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to request refund for this order' });
        }

        const { amount, reason } = req.body;

        order.refunds.push({
            amount: parseFloat(amount),
            reason,
            status: 'pending',
            requestedAt: new Date()
        });

        await order.save();

        res.json({ message: 'Refund requested successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error requesting refund', error: error.message });
    }
});

// Process refund (admin only)
router.put('/:orderId/refund/:refundId', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const refund = order.refunds.id(req.params.refundId);
        if (!refund) {
            return res.status(404).json({ message: 'Refund not found' });
        }

        refund.status = status;
        refund.processedAt = new Date();

        await order.save();

        res.json({ message: 'Refund processed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error processing refund', error: error.message });
    }
});

// Get all orders (admin only)
router.get('/', auth, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const orders = await Order.find(filter)
            .populate('customer', 'profile.firstName profile.lastName')
            .populate('items.artwork', 'title images')
            .populate('items.artist', 'painterProfile.artistName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

module.exports = router;