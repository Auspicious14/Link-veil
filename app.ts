import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes";
import linkRoutes from "./routes/linkRoutes";
import { accessGateway, getLinkById } from "./controllers/linkController";
import { ApiError } from "./utils/ApiError";

dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Home route
app.get("/", (req: Request, res: Response) => {
  res.send("Backend is working");
});

app.use("/api/users", userRoutes);
app.use("/api/links", linkRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
