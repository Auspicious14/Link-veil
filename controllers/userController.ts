import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = registerSchema.parse(req.body);
  let user = await User.findOne({ email });
  if (user) throw new ApiError(400, 'User already exists');
  user = new User({ name, email, password });
  await user.save();
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  res.status(201).json({ user, token });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid credentials');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  res.json({ user, token });
});

export const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById((req as any).user.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json(user);
});