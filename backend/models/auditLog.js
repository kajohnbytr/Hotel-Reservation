import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: { type: String, required: true },
    userName: { type: String, default: '' },
    role: { type: String, enum: ['guest', 'staff', 'admin'], default: null },
    action: { type: String, required: true },
    details: { type: String, default: '' },
  },
  { timestamps: true, collection: 'auditlogs' }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ role: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
