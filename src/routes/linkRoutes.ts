import express from 'express';
import { createLink, getLinkById, getLinkStats, getUserLinks } from '../controllers/linkController';
import { protect } from '../middlewares/authMiddleware';
import requestRoutes from './requestRoutes'; // Import the nested routes

const router = express.Router();

// Nest the request routes under a specific link shortId
router.use('/:shortId', requestRoutes);

// Main link routes
router.route('/')
    .post(protect, createLink);

router.route('/')
    .get(protect, getUserLinks);

router.route('/:shortId')
    .get(getLinkById);

router.route('/:shortId/stats')
    .get(protect, getLinkStats);

export default router;