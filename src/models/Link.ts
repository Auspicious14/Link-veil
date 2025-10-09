import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILink extends Document {
  title: string;
  url: string;
  shortId: string;
  owner: Types.ObjectId;
  visibility: 'public' | 'request' | 'private';
  approvalMode: "manual" | "auto" | "domain";
  approvedDomain?: string;
  approvedUsers: string[];
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const LinkSchema: Schema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  shortId: { type: String, required: true, unique: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['public', 'request', 'private'], default: 'public' },
  approvalMode: { type: String, enum: ['manual', 'auto', 'domain'], default: 'manual' },
  approvedDomain: { type: String },
  approvedUsers: [{ type: String }],
  clickCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LinkSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<ILink>('Link', LinkSchema);