import { Router } from "express";
import { addUser, getUsers, updateUser, deleteUser } from "../controllers/userController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get("/", getUsers);
router.post("/", addUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
