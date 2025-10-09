import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Link, { ILink } from '../models/Link';
import AccessRequest, { IAccessRequest } from '../models/AccessRequest';
import User, { IUser } from '../models/User';
import { sendEmail } from '../utils/sendEmail';

// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: IUser;
}

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
export const requestAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = requestAccessSchema.parse(req);
    const { shortId } = params;
    const requesterEmail = req.user?.email || req.body.email;
    const requesterId = req.user?._id;

    if (!requesterEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for non-authenticated users.',
      });
    }

    const link = await Link.findOne({ shortId }).populate('owner');
    if (!link) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    if (link.visibility !== 'request') {
        return res.status(400).json({ success: false, message: 'This link does not require access requests.' });
    }

    // Check if user is already approved
    if (link.approvedUsers.includes(requesterEmail)) {
      return res.status(400).json({ success: false, message: 'Access has already been granted.' });
    }

    // Auto-approval mode
    if (link.approvalMode === 'auto') {
      link.approvedUsers.push(requesterEmail);
      await link.save();
      return res.status(200).json({
        success: true,
        status: 'approved',
        message: 'Access granted automatically.',
      });
    }

    // Domain-based approval mode
    if (link.approvalMode === 'domain') {
        if (!link.approvedDomain) {
            return res.status(500).json({ success: false, message: 'Link owner has not configured the approved domain.' });
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

    // Manual approval mode
    const existingRequest = await AccessRequest.findOne({ linkId: link._id, requesterEmail });
    if (existingRequest && existingRequest.status === 'pending') {
        return res.status(400).json({ success: false, message: 'You already have a pending request for this link.' });
    }

    await AccessRequest.create({
      linkId: link._id,
      requesterEmail,
      requesterId,
      status: 'pending',
    });

    // Notify owner
    const owner = link.owner as unknown as IUser;
    await sendEmail({
      to: owner.email,
      subject: 'New Access Request for Your Link',
      text: `User ${requesterEmail} has requested access to your link: ${link.title} (${process.env.BASE_URL}/${link.shortId}).`,
    });

    res.status(201).json({
      success: true,
      status: 'pending',
      message: 'Your request has been submitted for approval.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve an access request
 * @route   POST /api/links/:shortId/approve
 * @access  Private (Owner only)
 */
export const approveRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body, params } = approveRequestSchema.parse(req);
    const { shortId } = params;
    const { requesterEmail } = body;

    const link = await Link.findOne({ shortId });
    if (!link) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    // Verify owner
    if (link.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to approve requests for this link.' });
    }

    const request = await AccessRequest.findOne({
      linkId: link._id,
      requesterEmail,
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'No pending request found for this user.' });
    }

    request.status = 'approved';
    await request.save();

    if (!link.approvedUsers.includes(requesterEmail)) {
      link.approvedUsers.push(requesterEmail);
      await link.save();
    }

    res.status(200).json({ success: true, message: 'Access approved successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all access requests for a link
 * @route   GET /api/links/:shortId/requests
 * @access  Private (Owner only)
 */
export const getRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shortId } = req.params;

    const link = await Link.findOne({ shortId });
    if (!link) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    // Verify owner
    if (link.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view requests for this link.' });
    }

    const requests = await AccessRequest.find({ linkId: link._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};