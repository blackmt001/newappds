const express = require('express');
const Shipment = require('../models/Shipment'); // Assuming models/Shipment.js exists
const STATUS = require('../utils/status');

const router = express.Router();
const cron = require('node-cron');

const generate_tracking_number = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // Uppercase letters
  const numbers = '0123456789'; // Digits

  let trackingCode = '';
  const totalLength = 13; // Total length is 10 letters + 3 numbers

  while (trackingCode.length < totalLength) {
    if (trackingCode.length < 10) {
      // Add a letter if the tracking code has less than 10 letters
      trackingCode += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      // Add a number if there are already 10 letters
      trackingCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
  }

  // Shuffle the result to ensure randomness
  return trackingCode
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
// Create Shipment
router.post('/', async (req, res) => {
  const { itemName, itemDescription, customerAddress, customerNotes, testMode, customerName, origin, destination } = req.body;

  if (!customerName || !origin || !destination || !customerAddress) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const trackingNumber = generate_tracking_number();
  try {
    const shipment = new Shipment({
      trackingNumber,
      customerName,
      itemName, itemDescription,
      customerNotes, testMode,
      origin,
      customerAddress,
      destination,
      status: STATUS[0],
      logs: [{ status: STATUS[0], details: 'Shipment created and processed', date: Date.now() }]
    });
    await shipment.save();
    res.status(201).json({ message: 'Shipment created successfully', shipment });
  } catch (err) {
    res.status(500).json({ message: 'Error creating shipment', error: err.message });
  }
});

const update_status = async () => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const shipments = await Shipment.find({ updatedAt: { $lt: twentyFourHoursAgo }, testMode: true, status: { $ne: "Delivered" } }).lean();
    console.log("shipments------->", shipments.length)
    if (shipments && shipments.length) {
      for (let i = 0; i < shipments.length; i++) {
        let shipment = shipments[i]
        let status = shipment.status;
        let currentStatusIndex = STATUS.findIndex((s)=>{return s == status});
        let nextIndex = currentStatusIndex + 1;
        let nextStatus = STATUS[nextIndex];
        let logs = shipment.logs;
        logs.push({ status: nextStatus, date: Date.now() });
        // console.log("logs",logs,status)
        await Shipment.updateOne({_id:shipment._id},{$set:{logs,status:nextStatus}});
      }
    }
  } catch (err) {
    console.log("err-in cron job",err)
  }
}

cron.schedule('* * * * *', async () => {
  console.log('Running cron job to update shipments...');
  await update_status();
});
// Create Shipment
router.patch('/:shipmentId', async (req, res) => {
  const { status } = req.body;
  const { shipmentId } = req.params;

  if (!status || !shipmentId) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  let shipment = await Shipment.findById(shipmentId);
  try {

    if (shipment) {
      let logs = shipment.logs;
      if (status) {
        logs.push({ status: status, date: Date.now() });
        shipment = await Shipment.findByIdAndUpdate(shipmentId, { $set: { logs, status } }, { returnDocument: 'after' });
        console.log("shipment", status, shipmentId, shipment);
      }
    }
    res.status(201).json({ message: 'Shipment updated successfully', shipment });
  } catch (err) {
    res.status(500).json({ message: 'Error creating shipment', error: err.message });
  }
});

router.get('/status/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    // Fetch paginated shipments
    console.log("trackingNumber", trackingNumber);
    const _shipment = await Shipment.findOne({ trackingNumber: trackingNumber });
    let estimatedDelivery = new Date(_shipment.createdAt);
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 24);
    const shipment = {
      trackingNumber: _shipment.trackingNumber,
      customerName: _shipment.customerName,
      origin: _shipment.origin,
      destination: _shipment.destination,
      status: _shipment.status,
      logs: _shipment.logs,
      estimatedDelivery
    }
    res.status(200).json({
      message: 'Shipment fetched successfully',
      shipment
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching shipment', error: err.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Fetch paginated shipments
    console.log("id", id);
    const shipment = await Shipment.findById(id);

    res.status(200).json({
      message: 'Shipment fetched successfully',
      shipment
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching shipment', error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Determine sort order
    const sortOrder = order === 'desc' ? -1 : 1;

    // Fetch paginated shipments
    const shipments = await Shipment.find()
      .sort({ [sort]: sortOrder })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Total count of shipments
    const count = await Shipment.countDocuments();

    res.status(200).json({
      message: 'Shipments fetched successfully',
      shipments,
      total: count,
      page: pageNumber,
      pages: Math.ceil(count / limitNumber),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching shipments', error: err.message });
  }
});
// Get Tracking Log by Tracking Number
router.get('/:trackingNumber/logs', async (req, res) => {
  const { trackingNumber } = req.params;

  try {
    const shipment = await Shipment.findOne({ trackingNumber });

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    res.json({ logs: shipment.logs });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving logs', error: err.message });
  }
});

// Update Status and Append to Shipment Log
router.put('/:trackingNumber/status', async (req, res) => {
  const { trackingNumber } = req.params;
  const { status, details } = req.body;

  if (!status || !details) {
    return res.status(400).json({ message: 'Status and details are required' });
  }

  try {
    const shipment = await Shipment.findOne({ trackingNumber });

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    shipment.status = status;
    shipment.logs.push({ status, details });
    await shipment.save();

    res.json({ message: 'Status updated and log appended', shipment });
  } catch (err) {
    res.status(500).json({ message: 'Error updating status', error: err.message });
  }
});

module.exports = router;
