import { Router } from "express";
import { beamsAuth } from "../controllers/beamsController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/auth", authenticate, beamsAuth);

export default router;