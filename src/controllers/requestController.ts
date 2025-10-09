import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Link from '../models/Link';
import AccessRequest from '../models/AccessRequest';
import User, { IUser } from '../models/User';
import { sendEmail } from '../utils/sendEmail';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';

// Zod Schemas for validation
const requestAccessSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
  }),
  params: z.object({
    shortId: z.string(),
  }),
});

const approveRequestSchema = z.object({
  body: z.object({
    requesterEmail: z.string().email('A valid requester email is required'),
  }),
  params: z.object({
    shortId: z.string(),
  }),
});

/**
 * @desc    Request access to a link
 * @route   POST /api/links/:shortId/request-access
 * @access  Public / Private (Authenticated)
 */
export const requestAccess = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { params, body } = requestAccessSchema.parse(req);
  const { shortId } = params;
  const requesterEmail = (req as any).user?.email || body.email;
  const requesterId = (req as any).user?._id;

  if (!requesterEmail) {
    throw new ApiError(400, 'Email is required for non-authenticated users.');
  }

  const link = await Link.findOne({ shortId }).populate('owner');
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }

  if (link.visibility !== 'request') {
      throw new ApiError(400, 'This link does not require access requests.');
  }

  if (link.approvedUsers.includes(requesterEmail)) {
    throw new ApiError(400, 'Access has already been granted.');
  }

  if (link.approvalMode === 'auto') {
    link.approvedUsers.push(requesterEmail);
    await link.save();
    return res.status(200).json({
      success: true,
      status: 'approved',
      message: 'Access granted automatically.',
    });
  }

  if (link.approvalMode === 'domain') {
      if (!link.approvedDomain) {
          throw new ApiError(500, 'Link owner has not configured the approved domain.');
      }
      const requesterDomain = requesterEmail.split('@')[1];
      if (requesterDomain === link.approvedDomain) {
          link.approvedUsers.push(requesterEmail);
          await link.save();
          return res.status(200).json({
          success: true,
          status: 'approved',
          message: `Access granted automatically for domain: ${link.approvedDomain}`,
          });
      }
  }

  const existingRequest = await AccessRequest.findOne({ linkId: link._id, requesterEmail, status: 'pending' });
  if (existingRequest) {
      throw new ApiError(400, 'You already have a pending request for this link.');
  }

  await AccessRequest.create({
    linkId: link._id,
    requesterEmail,
    requesterId,
    status: 'pending',
  });

  const owner = link.owner as unknown as IUser;
  await sendEmail({
    to: owner.email,
    subject: 'New Access Request for Your Link',
    text: `User ${requesterEmail} has requested access to your link: ${link.title}.`,
  });

  res.status(201).json({
    success: true,
    status: 'pending',
    message: 'Your request has been submitted for approval.',
  });
});

/**
 * @desc    Approve an access request
 * @route   POST /api/links/:shortId/approve
 * @access  Private (Owner only)
 */
export const approveRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { body, params } = approveRequestSchema.parse(req);
  const { shortId } = params;
  const { requesterEmail } = body;

  const link = await Link.findOne({ shortId });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }

  if (link.owner.toString() !== (req as any).user?._id.toString()) {
    throw new ApiError(403, 'You are not authorized to approve requests for this link.');
  }

  const request = await AccessRequest.findOne({
    linkId: link._id,
    requesterEmail,
    status: 'pending',
  });

  if (!request) {
    throw new ApiError(404, 'No pending request found for this user.');
  }

  request.status = 'approved';
  await request.save();

  if (!link.approvedUsers.includes(requesterEmail)) {
    link.approvedUsers.push(requesterEmail);
    await link.save();
  }

  res.status(200).json({ success: true, message: 'Access approved successfully.' });
});

/**
 * @desc    Get all access requests for a link
 * @route   GET /api/links/:shortId/requests
 * @access  Private (Owner only)
 */
export const getRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { shortId } = req.params;

  const link = await Link.findOne({ shortId });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }

  if (link.owner.toString() !== (req as any).user?._id.toString()) {
    throw new ApiError(403, 'You are not authorized to view requests for this link.');
  }

  const requests = await AccessRequest.find({ linkId: link._id }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: requests,
  });
});