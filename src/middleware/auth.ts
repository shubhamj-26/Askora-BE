import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getTokenModel } from "../models/OrgModels";

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ success: false, message: "No token provided" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const jwtSecret = process.env.JWT_SECRET || "secret";
        const decoded = jwt.verify(token, jwtSecret) as {
            userId: string;
            email: string;
            role: "admin" | "user";
            companyDbName: string;
        };

        // Check token exists in DB (allows revocation)
        const conn = getOrgConnection(decoded.companyDbName);
        const TokenModel = getTokenModel(conn);
        const tokenRecord = await TokenModel.findOne({ token, userId: decoded.userId });

        if (!tokenRecord) {
            res.status(401).json({ success: false, message: "Token is invalid or expired" });
            return;
        }

        if (tokenRecord.expiresAt < new Date()) {
            await TokenModel.deleteOne({ token });
            res.status(401).json({ success: false, message: "Token expired" });
            return;
        }

        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

export const requireAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (req.user?.role !== "admin") {
        res.status(403).json({ success: false, message: "Admin access required" });
        return;
    }
    next();
};