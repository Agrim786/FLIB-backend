const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Address = require('../models/Address');

// Get all addresses for user
router.get('/', auth, async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.Id })
      .sort({ isDefault: -1, updatedAt: -1 });
    res.json(addresses);
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// Add new address
router.post('/', auth, async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    } = req.body;

    // If this is the first address or isDefault is true, update other addresses
    if (isDefault) {
      await Address.updateMany(
        { userId: req.user.Id },
        { isDefault: false }
      );
    }

    const address = new Address({
      userId: req.user.Id,
      fullName,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false
    });

    await address.save();
    res.status(201).json(address);
  } catch (err) {
    console.error('Error adding address:', err);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// Update address
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    } = req.body;

    // If setting as default, update other addresses
    if (isDefault) {
      await Address.updateMany(
        { userId: req.user.Id },
        { isDefault: false }
      );
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.Id },
      {
        fullName,
        phoneNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        isDefault: isDefault || false
      },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json(address);
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// Delete address
router.delete('/:id', auth, async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.Id
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If deleted address was default, set another address as default
    if (address.isDefault) {
      const remainingAddresses = await Address.find({ userId: req.user.Id });
      if (remainingAddresses.length > 0) {
        remainingAddresses[0].isDefault = true;
        await remainingAddresses[0].save();
      }
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    console.error('Error deleting address:', err);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// Set default address
router.put('/:id/default', auth, async (req, res) => {
  try {
    // Update all addresses to not default
    await Address.updateMany(
      { userId: req.user.Id },
      { isDefault: false }
    );

    // Set selected address as default
    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.Id },
      { isDefault: true },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json(address);
  } catch (err) {
    console.error('Error setting default address:', err);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

module.exports = router; 