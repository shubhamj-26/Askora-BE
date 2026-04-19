import { Router } from "express";
import {
    getMessages,
    sendMessage,
    getPersonalMessages,
    sendPersonalMessage,
    markRead,
    getUnreadCounts,
} from "../controllers/chatController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// Team chat
router.get("/", getMessages);
router.post("/", sendMessage);
router.post("/read", markRead);

// Personal chat
router.get("/personal/:receiverId", getPersonalMessages);
router.post("/personal", sendPersonalMessage);
router.get("/unread-counts", getUnreadCounts);

export default router;