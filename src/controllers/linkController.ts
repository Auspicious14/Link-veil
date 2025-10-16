import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import axios from 'axios';
import Link from '../models/Link';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';

const createLinkSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  url: z.string().url('A valid URL is required'),
});

export const createLink = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, url } = createLinkSchema.parse(req.body);
  if (!(req as any).user) {
    throw new ApiError(401, 'User not authenticated');
  }
  const shortId = nanoid(10);
  const gatewayId = nanoid(10);
  const link = new Link({
    title,
    url,
    shortId,
    gatewayId,
    owner: (req as any).user._id,
  });
  await link.save();
  const fullUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/g/${gatewayId}`;
  res.status(201).json({
    success: true,
    message: 'Link created successfully',
    data: { link, fullUrl },
  });
});

export const accessGateway = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { gatewayId } = req.params;
  const link = await Link.findOne({ gatewayId });
  if (!link) {
    throw new ApiError(404, 'Gateway not found');
  }
  const visitorShortId = nanoid(10);
  const visitorLink = new Link({
    title: link.title,
    url: link.url,
    shortId: visitorShortId,
    owner: link.owner,
    clickCount: 0,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await visitorLink.save();
  res.redirect(302, `/l/${visitorShortId}`);
});

export const getLinkById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ApiError(403, 'Link expired');
  }
  link.clickCount++;
  await link.save();
  try {
    const response = await axios.get(link.url, { responseType: 'stream' });
    res.set(response.headers);
    response.data.pipe(res);
  } catch (error) {
    throw new ApiError(500, 'Error fetching URL content');
  }
});

export const getLinkStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    throw new ApiError(401, 'User not authenticated');
  }
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId, owner: (req as any).user._id });
  if (!link) {
    throw new ApiError(404, 'Link not found or you are not the owner');
  }
  res.status(200).json({
    success: true,
    data: { clickCount: link.clickCount },
  });
});

export const getUserLinks = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    throw new ApiError(401, 'User not authenticated');
  }
  const links = await Link.find({ owner: (req as any).user._id });
  const linksWithFullUrls = links.map(link => {
    const fullUrl = link.gatewayId
      ? `${process.env.BASE_URL || 'http://localhost:3000'}/g/${link.gatewayId}`
      : `${process.env.BASE_URL || 'http://localhost:3000'}/l/${link.shortId}`;
    return { ...link.toObject(), fullUrl };
  });
  res.status(200).json({
    success: true,
    count: links.length,
    data: linksWithFullUrls,
  });
});