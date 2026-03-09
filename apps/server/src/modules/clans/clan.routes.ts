// ─── Clan Routes ────────────────────────────────────────────────────────────

import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../auth/auth.middleware.ts";
import {
    handleCreateClan,
    handleListClans,
    handleGetMyClan,
    handleGetClan,
    handleUpdateClan,
    handleDeleteClan,
    handleJoinClan,
    handleJoinByInvite,
    handleLeaveClan,
    handleAcceptMember,
    handleRejectMember,
    handleKickMember,
    handleRegenerateInvite,
    handleUploadClanAvatar,
    handleGetClanMessages,
} from "./clan.controller.ts";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

export const clansRouter = Router();

// Public
clansRouter.get("/", handleListClans);

// Authenticated
clansRouter.post("/", authMiddleware, handleCreateClan);
clansRouter.get("/me", authMiddleware, handleGetMyClan);
clansRouter.get("/:id", handleGetClan);
clansRouter.patch("/:id", authMiddleware, handleUpdateClan);
clansRouter.delete("/:id", authMiddleware, handleDeleteClan);

// Membership
clansRouter.post("/:id/join", authMiddleware, handleJoinClan);
clansRouter.post("/invite/:code", authMiddleware, handleJoinByInvite);
clansRouter.post("/:id/leave", authMiddleware, handleLeaveClan);
clansRouter.post("/:id/members/:userId/accept", authMiddleware, handleAcceptMember);
clansRouter.post("/:id/members/:userId/reject", authMiddleware, handleRejectMember);
clansRouter.post("/:id/members/:userId/kick", authMiddleware, handleKickMember);

// Clan management
clansRouter.post("/:id/invite", authMiddleware, handleRegenerateInvite);
clansRouter.post("/:id/avatar", authMiddleware, upload.single("avatar"), handleUploadClanAvatar);

// Chat (REST fallback for history)
clansRouter.get("/:id/messages", authMiddleware, handleGetClanMessages);
