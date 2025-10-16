import { Schema, model, Document, Types } from 'mongoose';

export interface ILink extends Document {
  title: string;
  url: string;
  shortId: string;
  gatewayId?: string;
  owner: Types.ObjectId;
  clickCount: number;
  expiresAt?: Date;
}

const LinkSchema: Schema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  shortId: { type: String, required: true, unique: true },
  gatewayId: { type: String, unique: true, sparse: true }, // sparse allows multiple nulls
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clickCount: { type: Number, default: 0 },
  expiresAt: { type: Date },
});

LinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export default model<ILink>('Link', LinkSchema);