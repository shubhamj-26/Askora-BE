import { Response } from "express";
import { AuthRequest } from "../types/index";

export const beamsAuth = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName, role } = req.user!;
        const beamsUserId = `${companyDbName}_${userId}`;

        // Return the user ID for Pusher Beams client-side auth
        // The client uses this to associate the browser with the user
        res.json({
            success: true,
            data: {
                beamsUserId,
                companyDbName,
                role,
                // Interest channels this user should subscribe to
                interests: [
                    `org-${companyDbName}`,
                    `user-${userId}`,
                    role === "admin" ? `admin-${companyDbName}` : null,
                ].filter(Boolean),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Beams auth failed" });
    }
};