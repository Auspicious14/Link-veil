import express from "express";
import {
  accessGateway,
  createLink,
  deleteUserLink,
  getLinkById,
  getLinkStats,
  getUserLinks,
} from "../controllers/linkController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.route("/").post(protect, createLink).get(protect, getUserLinks);

router.route("/:shortId").get(getLinkById);

router.route("/:shortId/stats").get(protect, getLinkStats);

router.route("/:shortId").delete(protect, deleteUserLink);

router.route("/g/:gatewayId").get(accessGateway);

export default router;
