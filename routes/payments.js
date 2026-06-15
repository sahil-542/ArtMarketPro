const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Create payment intent
router.post('/create-intent', auth, async (req, res) => {
    try {
        const { orderId } = req.body;
        
        const order = await Order.findById(orderId).populate('customer');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is the customer
        if (order.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to pay for this order' });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                orderId: orderId,
                customerId: order.customer._id.toString()
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            amount: order.total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payment intent', error: error.message });
    }
});

// Confirm payment
router.post('/confirm', auth, async (req, res) => {
    try {
        const { paymentIntentId, orderId } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded') {
            const order = await Order.findById(orderId);
            
            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            // Update order payment status
            order.payment.status = 'completed';
            order.payment.transactionId = paymentIntent.id;
            order.status = 'confirmed';
            await order.save();

            res.json({ message: 'Payment confirmed successfully', order });
        } else {
            res.status(400).json({ message: 'Payment not successful' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error confirming payment', error: error.message });
    }
});

// Create connected account for artists
router.post('/connect-account', auth, async (req, res) => {
    try {
        if (req.user.role !== 'painter') {
            return res.status(403).json({ message: 'Only artists can create connected accounts' });
        }

        const account = await stripe.accounts.create({
            type: 'express',
            country: 'US',
            email: req.user.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            }
        });

        // Update user with stripe account ID
        await User.findByIdAndUpdate(req.user._id, {
            'painterProfile.stripeAccountId': account.id
        });

        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.CLIENT_URL}/artist/payments?refresh=true`,
            return_url: `${process.env.CLIENT_URL}/artist/payments?success=true`,
            type: 'account_onboarding'
        });

        res.json({
            accountId: account.id,
            onboardingUrl: accountLink.url
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating connected account', error: error.message });
    }
});

// Get account status
router.get('/account-status', auth, async (req, res) => {
    try {
        if (!req.user.painterProfile?.stripeAccountId) {
            return res.json({ status: 'not_connected' });
        }

        const account = await stripe.accounts.retrieve(req.user.painterProfile.stripeAccountId);
        
        res.json({
            status: account.details_submitted ? 'complete' : 'incomplete',
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            requirements: account.requirements
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching account status', error: error.message });
    }
});

// Create payout
router.post('/payout', auth, async (req, res) => {
    try {
        if (req.user.role !== 'painter') {
            return res.status(403).json({ message: 'Only artists can request payouts' });
        }

        if (!req.user.painterProfile?.stripeAccountId) {
            return res.status(400).json({ message: 'No connected account found' });
        }

        const { amount } = req.body;

        // Check if artist has sufficient balance
        if (req.user.wallet.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Create payout
        const payout = await stripe.payouts.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            method: 'standard'
        }, {
            stripeAccount: req.user.painterProfile.stripeAccountId
        });

        // Update user wallet
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'wallet.balance': -amount }
        });

        res.json({ message: 'Payout created successfully', payout });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payout', error: error.message });
    }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const orders = await Order.find({ 
            customer: req.user._id,
            'payment.status': 'completed'
        })
        .populate('items.artwork', 'title images')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

        const total = await Order.countDocuments({ 
            customer: req.user._id,
            'payment.status': 'completed'
        });

        res.json({
            payments: orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment history', error: error.message });
    }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const orderId = paymentIntent.metadata.orderId;
            
            if (orderId) {
                await Order.findByIdAndUpdate(orderId, {
                    'payment.status': 'completed',
                    'payment.transactionId': paymentIntent.id,
                    status: 'confirmed'
                });
            }
            break;
            
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            const failedOrderId = failedPayment.metadata.orderId;
            
            if (failedOrderId) {
                await Order.findByIdAndUpdate(failedOrderId, {
                    'payment.status': 'failed'
                });
            }
            break;
            
        case 'payout.paid':
            const payout = event.data.object;
            // Handle successful payout
            break;
            
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

module.exports = router;