import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Link, { ILink } from '../models/Link';
import { generateShortId } from '../utils/generateShortId';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';

const createLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  visibility: z.enum(['public', 'request', 'private']).optional(),
});

export const createLink = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, url, visibility } = createLinkSchema.parse(req.body);
  const shortId = generateShortId();
  const link = new Link({ title, url, shortId, owner: (req as any).user.id, visibility });
  await link.save();
  const fullUrl = `${process.env.BASE_URL}/l/${shortId}`;
  res.status(201).json({ link, fullUrl });
});

export const getLink = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId });
  if (!link) throw new ApiError(404, 'Link not found');
  if (link.visibility === 'public') {
    link.clickCount++;
    await link.save();
    return res.json({ url: link.url });
  }
  if (link.visibility === 'private' && link.owner.toString() !== (req as any).user?.id) {
    throw new ApiError(403, 'Private link');
  }
  if (link.visibility === 'request') {
    if (link.approvedUsers.includes((req as any).user?.email || req.body.email)) {
      link.clickCount++;
      await link.save();
      return res.json({ url: link.url });
    }
    return res.json({ metadata: { title: link.title, visibility: link.visibility } });
  }
  link.clickCount++;
  await link.save();
  res.json({ url: link.url });
});

export const getLinkStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId, owner: (req as any).user.id });
  if (!link) throw new ApiError(404, 'Link not found or not owned');
  res.json({ clickCount: link.clickCount });
});