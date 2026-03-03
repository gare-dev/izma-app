// ─── Games Routes ───────────────────────────────────────────────────────────

import { Router } from "express";
import { handleGetGames } from "./games.controller.ts";

export const gamesRouter = Router();

gamesRouter.get("/", handleGetGames);
