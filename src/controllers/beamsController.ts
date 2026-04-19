import { Response } from "express";
import { AuthRequest } from "../types/index";

export const beamsAuth = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName, role } = req.user!;

        // Return interests (Pusher channel names) for this user to subscribe to
        const interests = [
            `org-${companyDbName}`,                          // org-wide events
            `user-${userId}`,                                 // user-specific events
            ...(role === "admin" ? [`admin-${companyDbName}`] : []),  // admin-only events
        ].filter(Boolean) as string[];

        res.json({
            success: true,
            data: {
                beamsUserId: `${companyDbName}_${userId}`,
                companyDbName,
                role,
                interests,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Beams auth failed" });
    }
};