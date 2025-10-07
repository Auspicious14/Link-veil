import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import AccessRequest, { IAccessRequest } from "../models/AccessRequest";
import Link from "../models/Link";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";

const requestAccessSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
});

export const requestAccess = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { shortId } = req.params;
    const { email, name } = requestAccessSchema.parse(req.body);
    const link = await Link.findOne({ shortId });
    if (!link) throw new ApiError(404, "Link not found");
    if (link.visibility !== "request")
      throw new ApiError(400, "Link does not require request");
    const existingRequest = await AccessRequest.findOne({
      linkId: link._id,
      requesterEmail: email,
    });
    if (existingRequest) {
      if (existingRequest.status === "approved")
        return res.json({ status: "approved" });
      return res.json({ status: "pending" });
    }
    const accessRequest = new AccessRequest({
      linkId: link._id,
      requesterEmail: email,
      requesterName: name,
    });
    await accessRequest.save();
    res.status(201).json({ status: "pending" });
  }
);

const approveSchema = z.object({
  requesterEmail: z.email(),
});

export const approveRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { shortId } = req.params;
    const { requesterEmail } = approveSchema.parse(req.body);
    const link = await Link.findOne({ shortId, owner: (req as any).user.id });
    if (!link) throw new ApiError(404, "Link not found or not owned");
    const accessRequest = await AccessRequest.findOne({
      linkId: link._id,
      requesterEmail,
    });
    if (!accessRequest) throw new ApiError(404, "Request not found");
    accessRequest.status = "approved";
    await accessRequest.save();
    if (!link.approvedUsers.includes(requesterEmail)) {
      link.approvedUsers.push(requesterEmail);
      await link.save();
    }
    res.json({ message: "Request approved" });
  }
);
