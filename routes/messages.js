const express = require('express');
const router = express.Router();
const { Message, Conversation } = require('../models/Message');
const { auth } = require('../middleware/auth');

// Get user's conversations
router.get('/conversations', auth, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            'participants.user': req.user._id,
            isActive: true
        })
        .populate('participants.user', 'profile.firstName profile.lastName painterProfile.artistName')
        .populate('lastMessage.sender', 'profile.firstName profile.lastName')
        .sort({ updatedAt: -1 })
        .exec();

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations', error: error.message });
    }
});

// Get conversation messages
router.get('/conversation/:conversationId', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        
        const conversation = await Conversation.findById(req.params.conversationId)
            .populate('participants.user', 'profile.firstName profile.lastName');

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Check if user is part of the conversation
        const isParticipant = conversation.participants.some(p => p.user._id.toString() === req.user._id.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to view this conversation' });
        }

        const messages = await Message.find({ conversation: req.params.conversationId })
            .populate('sender', 'profile.firstName profile.lastName painterProfile.artistName')
            .populate('attachments')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Mark messages as read
        await Message.updateMany(
            { 
                conversation: req.params.conversationId, 
                recipient: req.user._id,
                'read.status': false
            },
            { 
                'read.status': true, 
                'read.readAt': new Date() 
            }
        );

        // Update conversation's unread count
        const participant = conversation.participants.find(p => p.user._id.toString() === req.user._id.toString());
        if (participant) {
            participant.unreadCount = 0;
            participant.lastReadAt = new Date();
            await conversation.save();
        }

        res.json({
            messages: messages.reverse(), // Reverse to get chronological order
            conversation
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
});

// Send message
router.post('/', auth, async (req, res) => {
    try {
        const { conversationId, recipientId, content, attachments } = req.body;

        // Find or create conversation
        let conversation;
        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
        } else {
            // Check if conversation already exists
            conversation = await Conversation.findOne({
                'participants.user': { $all: [req.user._id, recipientId] },
                type: 'direct'
            });

            if (!conversation) {
                // Create new conversation
                conversation = new Conversation({
                    participants: [
                        { user: req.user._id },
                        { user: recipientId }
                    ],
                    type: 'direct'
                });
                await conversation.save();
            }
        }

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Create message
        const message = new Message({
            conversation: conversation._id,
            sender: req.user._id,
            recipient: recipientId,
            content,
            attachments: attachments || []
        });

        await message.save();

        // Update conversation's last message
        conversation.lastMessage = {
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            sender: req.user._id,
            timestamp: new Date(),
            attachments: attachments && attachments.length > 0
        };

        // Update unread count for other participants
        conversation.participants.forEach(participant => {
            if (participant.user.toString() !== req.user._id.toString()) {
                participant.unreadCount += 1;
            }
        });

        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'profile.firstName profile.lastName painterProfile.artistName');

        res.status(201).json(populatedMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
});

// Mark messages as read
router.put('/read/:conversationId', auth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Check if user is part of the conversation
        const isParticipant = conversation.participants.some(p => p.user.toString() === req.user._id.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to mark messages as read' });
        }

        // Mark all unread messages as read
        await Message.updateMany(
            { 
                conversation: req.params.conversationId, 
                recipient: req.user._id,
                'read.status': false
            },
            { 
                'read.status': true, 
                'read.readAt': new Date() 
            }
        );

        // Update conversation's unread count
        const participant = conversation.participants.find(p => p.user._id.toString() === req.user._id.toString());
        if (participant) {
            participant.unreadCount = 0;
            participant.lastReadAt = new Date();
            await conversation.save();
        }

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking messages as read', error: error.message });
    }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            recipient: req.user._id,
            'read.status': false
        });

        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
});

// Delete message
router.delete('/:messageId', auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is the sender
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        // Soft delete
        message.deleted = {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user._id
        };

        await message.save();

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting message', error: error.message });
    }
});

module.exports = router;