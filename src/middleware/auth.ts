import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getTokenModel } from "../models/OrgModels";

const getJwtSecret = () => process.env.JWT_SECRET || "askora_dev_secret";

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

        let decoded: {
            userId: string;
            email: string;
            role: "admin" | "user";
            companyDbName: string;
        };

        try {
            decoded = jwt.verify(token, getJwtSecret()) as typeof decoded;
        } catch (err: unknown) {
            const jwtErr = err as { name?: string };
            if (jwtErr.name === "TokenExpiredError") {
                res.status(401).json({
                    success: false,
                    message: "Access token expired",
                    code: "TOKEN_EXPIRED",
                });
            } else {
                res.status(401).json({ success: false, message: "Invalid token" });
            }
            return;
        }

        // Verify token exists in DB (supports revocation)
        const conn = getOrgConnection(decoded.companyDbName);
        const TokenModel = getTokenModel(conn);
        const tokenRecord = await TokenModel.findOne({
            token,
            userId: decoded.userId,
        });

        if (!tokenRecord) {
            res.status(401).json({
                success: false,
                message: "Token not found. Please log in again.",
            });
            return;
        }

        if (tokenRecord.expiresAt < new Date()) {
            await TokenModel.deleteOne({ token });
            res.status(401).json({
                success: false,
                message: "Access token expired",
                code: "TOKEN_EXPIRED",
            });
            return;
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ success: false, message: "Authentication failed" });
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