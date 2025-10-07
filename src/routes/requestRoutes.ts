import express from 'express';
import { requestAccess, approveRequest } from '../controllers/requestController';
import { authMiddleware } from '../utils/authMiddleware';

const router = express.Router();

router.post('/:shortId/request-access', requestAccess);
router.post('/:shortId/approve', authMiddleware, approveRequest);

export default router;