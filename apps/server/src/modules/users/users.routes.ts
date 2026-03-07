// ─── Users Routes ───────────────────────────────────────────────────────────

import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../auth/auth.middleware.ts";
import { handleGetMe, handleUpdateMe, handleUploadAvatar } from "./users.controller.ts";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

export const usersRouter = Router();

usersRouter.get("/me", authMiddleware, handleGetMe);
usersRouter.patch("/me", authMiddleware, handleUpdateMe);
usersRouter.post("/me/avatar", authMiddleware, upload.single("avatar"), handleUploadAvatar);
