const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

// Get user's notifications
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, category, unreadOnly } = req.query;
        
        const filter = { 
            recipient: req.user._id, 
            isActive: true,
            expiresAt: { $gt: new Date() }
        };

        if (type) filter.type = type;
        if (category) filter.category = category;
        if (unreadOnly === 'true') filter['read.status'] = false;

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({
            ...filter,
            'read.status': false
        });

        res.json({
            notifications,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total,
            unreadCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.getUnreadCount(req.user._id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await notification.markAsRead();

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking notification as read', error: error.message });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { 
                recipient: req.user._id, 
                'read.status': false,
                isActive: true
            },
            { 
                'read.status': true, 
                'read.readAt': new Date() 
            }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
    }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        notification.isActive = false;
        await notification.save();

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
});

// Create notification (for internal use)
router.post('/', auth, async (req, res) => {
    try {
        const { recipientId, title, message, type, category, data, channels } = req.body;

        const notification = new Notification({
            recipient: recipientId,
            sender: req.user._id,
            title,
            message,
            type: type || 'general',
            category: category || 'social',
            data: data || {},
            channels: channels || { inApp: true, email: false, push: false }
        });

        await notification.save();

        res.status(201).json(notification);
    } catch (error) {
        res.status(500).json({ message: 'Error creating notification', error: error.message });
    }
});

// Update notification preferences
router.put('/preferences', auth, async (req, res) => {
    try {
        const { email, push, newArtworks, newFollowers, messages, promotions } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                'preferences.notifications.email': email,
                'preferences.notifications.push': push,
                'preferences.notifications.newArtworks': newArtworks,
                'preferences.notifications.newFollowers': newFollowers,
                'preferences.notifications.messages': messages,
                'preferences.notifications.promotions': promotions
            },
            { new: true }
        ).select('preferences.notifications');

        res.json(user.preferences.notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification preferences', error: error.message });
    }
});

module.exports = router;