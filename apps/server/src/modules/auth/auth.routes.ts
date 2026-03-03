// ─── Auth Routes ────────────────────────────────────────────────────────────
// Express Router for /auth/* endpoints.

import { Router } from "express";
import { rateLimitAuth } from "./auth.middleware.ts";
import {
    handleRegister,
    handleLogin,
    handleGuest,
    handleRefresh,
    handleLogout,
} from "./auth.controller.ts";

export const authRouter = Router();

authRouter.post("/register", rateLimitAuth, handleRegister);
authRouter.post("/login", rateLimitAuth, handleLogin);
authRouter.post("/guest", handleGuest);
authRouter.post("/refresh", handleRefresh);
authRouter.post("/logout", handleLogout);
