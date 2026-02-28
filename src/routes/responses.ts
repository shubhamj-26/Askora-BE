import { Router } from "express";
import { submitResponse, getResponses, getUserResponse, getAllResponses } from "../controllers/responseController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/", submitResponse);
router.get("/", getAllResponses);
router.get("/:questionId", getResponses);
router.get("/:questionId/user", getUserResponse);

export default router;
