import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Link from '../models/Link';
import { IUser } from '../models/User';
import { generateShortId } from '../utils/generateShortId'; // Assuming this util exists
import { catchAsync } from '../utils/catchAsync'; // Assuming this util exists
import { ApiError } from '../utils/ApiError'; // Assuming this util exists

// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: IUser;
}

// Zod schema for creating a link
const createLinkSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  url: z.string().url('A valid URL is required'),
  visibility: z.enum(['public', 'request', 'private']).optional(),
  approvalMode: z.enum(['manual', 'auto', 'domain']).optional(),
  approvedDomain: z.string().optional(),
}).refine(data => {
    if (data.approvalMode === 'domain') {
        return !!data.approvedDomain && data.approvedDomain.length > 0;
    }
    return true;
}, {
    message: "approvedDomain is required when approvalMode is 'domain'",
    path: ["approvedDomain"],
});

/**
 * @desc    Create a new link
 * @route   POST /api/links
 * @access  Private
 */
export const createLink = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, url, visibility, approvalMode, approvedDomain } = createLinkSchema.parse(req.body);

  if (!req.user) {
    throw new ApiError(401, 'User not authenticated');
  }

  const shortId = generateShortId();

  const link = new Link({
      title,
      url,
      shortId,
      owner: req.user._id,
      visibility,
      approvalMode,
      approvedDomain: approvalMode === 'domain' ? approvedDomain : undefined,
  });

  await link.save();

  const fullUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/l/${shortId}`;

  res.status(201).json({
      success: true,
      message: "Link created successfully",
      data: {
        link,
        fullUrl
      }
  });
});

/**
 * @desc    Get a link by its short ID and handle access
 * @route   GET /api/links/:shortId
 * @access  Public/Private/Request
 */
export const getLinkById = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId });

  if (!link) {
    throw new ApiError(404, 'Link not found');
  }

  const isOwner = req.user && link.owner.toString() === req.user._id.toString();

  // Public links are accessible to everyone
  if (link.visibility === 'public') {
    link.clickCount++;
    await link.save();
    return res.status(200).json({ success: true, url: link.url });
  }

  // Private links are only accessible to the owner
  if (link.visibility === 'private') {
    if (!isOwner) {
      throw new ApiError(403, 'This link is private and you do not have access.');
    }
  }

  // Request-based links require approval or ownership
  if (link.visibility === 'request') {
    // Unauthenticated users for 'request' links
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication is required to access this link.',
            data: {
                visibility: link.visibility,
                title: link.title,
            }
        });
    }

    let isApproved = link.approvedUsers.includes(req.user.email);

    // If not the owner and not already in the approved list, check auto-approval rules
    if (!isOwner && !isApproved) {
        let grantedAutomatically = false;

        // Auto-approval mode
        if (link.approvalMode === 'auto') {
            grantedAutomatically = true;
        }
        // Domain-based approval mode
        else if (link.approvalMode === 'domain' && link.approvedDomain) {
            const requesterDomain = req.user.email.split('@')[1];
            if (requesterDomain === link.approvedDomain) {
                grantedAutomatically = true;
            }
        }

        if (grantedAutomatically) {
            // Add user to the list for future access and mark as approved for this request
            if (!link.approvedUsers.includes(req.user.email)) {
                link.approvedUsers.push(req.user.email);
                await link.save();
            }
            isApproved = true;
        }
    }

    // Final check for access
    if (!isOwner && !isApproved) {
      return res.status(403).json({
          success: false,
          message: 'You do not have access to this link. Please request access from the owner.',
          data: {
              visibility: link.visibility,
              title: link.title,
              requestStatus: 'required'
          }
      });
    }
  }

  // If all checks pass, grant access
  link.clickCount++;
  await link.save();
  res.status(200).json({ success: true, url: link.url });
});

/**
 * @desc    Get stats for a link
 * @route   GET /api/links/:shortId/stats
 * @access  Private (Owner only)
 */
export const getLinkStats = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'User not authenticated');
  }
  const { shortId } = req.params;
  const link = await Link.findOne({ shortId, owner: req.user.id });
  if (!link) {
    throw new ApiError(404, 'Link not found or you are not the owner');
  }
  res.status(200).json({
    success: true,
    data: {
      clickCount: link.clickCount,
      visibility: link.visibility,
      approvalMode: link.approvalMode
    }
  });
});