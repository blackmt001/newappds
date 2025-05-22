// the all fields: Shipment Timeline
// Order Processed
// Item Moved From Storage
// Packaging Materials Prepared
// Packaging Begins
// Packaging Completed
// Freight Shipping Scheduled
// Shipped From Warehouse
// Loaded Onto Truck
// In Transit – Initial Journey
// First Checkpoint Passed
// Midway Transit
// Second Checkpoint Passed
// Transit Continues
// Nearing Final Destination
// Entering Delivery Region
// Sorting at Distribution Hub
// Final Transit Begins
// Local Area Arrival
// Delivery Scheduled
// Final Confirmation
// Out for Delivery
// Delivered

const mongoose = require('mongoose');
// shipment Schema
const LogsSchema  = new mongoose.Schema({
    status:String,
    details:String,
    date:Date
})
const shipmentSchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true, unique: true },
  itemName: { type: String },
  itemDescription: { type: String },
  customerName: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerNotes: { type: String, required: false },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  status: {type: String, required: true},
  testMode: { type: Boolean, required: false , default:false },
  logs: [LogsSchema], 
},{
    timestamps: true // Automatically adds `createdAt` and `updatedAt`
});

const Shipment = mongoose.model('shipment', shipmentSchema);

module.exports = Shipment;
