// ─── Match History Routes ────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware.ts";
import { handleGetMyMatches } from "./match.controller.ts";

export const matchesRouter = Router();

matchesRouter.get("/me", authMiddleware, handleGetMyMatches);
