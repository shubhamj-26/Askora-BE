import { Router } from "express";
import {
    createQuestion,
    getQuestions,
    getQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionStats,
} from "../controllers/questionController.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getQuestions);
router.get("/:id", getQuestion);
router.get("/:id/stats", requireAdmin, getQuestionStats);
router.post("/", requireAdmin, createQuestion);
router.put("/:id", requireAdmin, updateQuestion);
router.delete("/:id", requireAdmin, deleteQuestion);

export default router;