// ─── Users Routes ───────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware.ts";
import { handleGetMe, handleUpdateMe } from "./users.controller.ts";

export const usersRouter = Router();

usersRouter.get("/me", authMiddleware, handleGetMe);
usersRouter.patch("/me", authMiddleware, handleUpdateMe);
