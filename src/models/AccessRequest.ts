import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAccessRequest extends Document {
  linkId: Types.ObjectId;
  requesterEmail: string;
  requesterId?: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

const AccessRequestSchema: Schema = new Schema({
  linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
  requesterEmail: { type: String, required: true },
  requesterId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IAccessRequest>('AccessRequest', AccessRequestSchema);