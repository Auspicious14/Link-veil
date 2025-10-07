import express from 'express';
import { createLink, getLink, getLinkStats } from '../controllers/linkController';
import { authMiddleware } from '../utils/authMiddleware';

const router = express.Router();

router.post('/', authMiddleware, createLink);
router.get('/:shortId', getLink);
router.get('/:shortId/stats', authMiddleware, getLinkStats);

export default router;