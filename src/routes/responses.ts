import { Router } from "express";
import {
    submitResponse,
    getResponses,
    getUserResponse,
    getAllResponses,
    updateResponse,
} from "../controllers/responseController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// IMPORTANT: specific routes BEFORE param routes to avoid conflicts
router.get("/", requireAdmin, getAllResponses);
router.post("/", submitResponse);
router.get("/question/:questionId", requireAdmin, getResponses);
router.get("/my/:questionId", getUserResponse);       // user's own response for a question
router.put("/:responseId", updateResponse);           // user can edit their response

export default router;