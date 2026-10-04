const mongoose = require('mongoose');
const ACTIONS = ['created', 'status_changed', 'deleted'];

const activityLogSchema = new mongoose.Schema(
  {
    application_id: { type: Number, required: true },
    user_id: { type: Number, required: true },
    action: { type: String, enum: ACTIONS, required: true },
    from: { type: String, default: null }, // previous status, when relevant
    to: { type: String, default: null },   // new status, when relevant
    at: { type: Date, default: Date.now },
  },
  {
    collection: 'activity_log',
    versionKey: false, // no __v; documents are never updated
  },
);

// "My recent activity" and "history of one application".
activityLogSchema.index({ user_id: 1, at: -1 });
activityLogSchema.index({ application_id: 1, at: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
module.exports.ACTIONS = ACTIONS;
