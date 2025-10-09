import express from 'express';
import { requestAccess, approveRequest, getRequests } from '../controllers/requestController';
import { protect, optionalAuth } from '../middlewares/authMiddleware';

const router = express.Router({ mergeParams: true });

// POST /api/links/:shortId/request-access
router.route('/request-access').post(optionalAuth, requestAccess);

// POST /api/links/:shortId/approve
router.route('/approve').post(protect, approveRequest);

// GET /api/links/:shortId/requests
router.route('/requests').get(protect, getRequests);

export default router;