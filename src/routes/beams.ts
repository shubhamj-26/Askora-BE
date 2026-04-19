import { Router } from "express";
import { beamsAuth } from "../controllers/beamsController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/auth", authenticate, beamsAuth);

export default router;