const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');

// ✅ Save a chat message
router.post('/', auth, async (req, res) => {
  const { text, room, sender, timestamp, senderName } = req.body;

  if (!text || !room || !sender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const chat = await Chat.create({ text, room, sender, timestamp, senderName });
    res.status(201).json(chat);
  } catch (error) {
    console.error('❌ Error saving chat:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

// ✅ Get all chats for a room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const messages = await Chat.find({ room: req.params.roomId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ✅ NEW: Prevent duplicate chat rooms
router.post('/initiate', auth, async (req, res) => {
  const { buyerId, sellerId, bookId, room } = req.body;

  try {
    const existingChat = await Chat.findOne({
      buyerId,
      sellerId,
      bookId
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    const chat = await Chat.create({
      buyerId,
      sellerId,
      bookId,
      room
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('❌ Error initiating chat:', error);
    res.status(500).json({ message: 'Failed to create chat' });
  }
});

// ✅ NEW: Get unread message count for current seller
router.get('/unread', auth, async (req, res) => {
  try {
    const count = await Chat.countDocuments({
      receiverId: req.user.userId,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
