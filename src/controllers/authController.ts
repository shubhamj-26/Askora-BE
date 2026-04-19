import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CompanyDetails } from "../models/CompanyDetails";
import { getOrgConnection } from "../config/database";
import { getUserModel, getTokenModel } from "../models/OrgModels";
import { SignupPayload, LoginPayload, AuthRequest } from "../types/index";

const JWT_EXPIRES_IN = "15m";          // Access token: short-lived
const REFRESH_EXPIRES_IN = "7d";       // Refresh token: long-lived

const getJwtSecret = () => process.env.JWT_SECRET || "askora_dev_secret";
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || "askora_refresh_secret";

// Helper: derive DB name from email domain
// shubham.jadhav@ndsofttech.com → ndsofttech_com
export const getDbNameFromEmail = (email: string): string => {
    const domain = email.split("@")[1];
    if (!domain) throw new Error("Invalid email address");
    return domain.replace(/\./g, "_");
};

const generateTokens = (payload: {
    userId: string;
    email: string;
    role: "admin" | "user";
    companyDbName: string;
}) => {
    const accessToken = jwt.sign(payload, getJwtSecret(), {
        expiresIn: JWT_EXPIRES_IN,
    } as object);

    const refreshToken = jwt.sign(
        { userId: payload.userId, companyDbName: payload.companyDbName },
        getRefreshSecret(),
        { expiresIn: REFRESH_EXPIRES_IN } as object
    );

    return { accessToken, refreshToken };
};

// ── Signup ────────────────────────────────────────────────────────────────────
export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, organizationName }: SignupPayload = req.body;

        if (!name || !email || !password || !organizationName) {
            res.status(400).json({ success: false, message: "All fields are required" });
            return;
        }

        let dbName: string;
        try {
            dbName = getDbNameFromEmail(email);
        } catch {
            res.status(400).json({ success: false, message: "Invalid email address" });
            return;
        }

        const domainName = email.split("@")[1];

        // Check if organisation already registered by email OR domain
        const existingByEmail = await CompanyDetails.findOne({ adminEmail: email });
        if (existingByEmail) {
            res.status(409).json({
                success: false,
                message:
                    "An organisation is already registered with this email. Please ask your admin to create a user account for you instead.",
            });
            return;
        }

        const existingByDomain = await CompanyDetails.findOne({ dbName });
        if (existingByDomain) {
            res.status(409).json({
                success: false,
                message: `A workspace for the domain "${domainName}" already exists. Ask your organisation admin to add you as a user.`,
            });
            return;
        }

        // Create company record in main DB
        const company = await CompanyDetails.create({
            organizationName,
            domainName,
            dbName,
            adminEmail: email,
        });

        // Create admin user in org-specific DB
        const conn = getOrgConnection(dbName);
        const UserModel = getUserModel(conn);

        const hashedPassword = await bcrypt.hash(password, 12);
        const adminUser = await UserModel.create({
            name,
            email,
            password: hashedPassword,
            role: "admin",
            companyDbName: dbName,
            isActive: true,
        });

        const userId = adminUser._id?.toString() ?? "";
        const { accessToken, refreshToken } = generateTokens({
            userId,
            email,
            role: "admin",
            companyDbName: dbName,
        });

        // Store both tokens
        const TokenModel = getTokenModel(conn);
        await TokenModel.create({
            userId,
            token: accessToken,
            refreshToken,
            companyDbName: dbName,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.status(201).json({
            success: true,
            message: "Organisation and workspace created successfully",
            data: {
                token: accessToken,
                refreshToken,
                user: {
                    id: adminUser._id,
                    name: adminUser.name,
                    email: adminUser.email,
                    role: adminUser.role,
                    companyDbName: dbName,
                    organizationName: company.organizationName,
                },
            },
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password }: LoginPayload = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password required" });
            return;
        }

        let dbName: string;
        try {
            dbName = getDbNameFromEmail(email);
        } catch {
            res.status(400).json({ success: false, message: "Invalid email address" });
            return;
        }

        const company = await CompanyDetails.findOne({ dbName });
        if (!company) {
            res.status(404).json({
                success: false,
                message: "No organisation found for this email domain. Please sign up to create a workspace.",
            });
            return;
        }

        const conn = getOrgConnection(dbName);
        const UserModel = getUserModel(conn);

        const user = await UserModel.findOne({ email, isActive: true });
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials or account is inactive" });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        const userId = user._id?.toString() ?? "";
        const { accessToken, refreshToken } = generateTokens({
            userId,
            email,
            role: user.role,
            companyDbName: dbName,
        });

        const TokenModel = getTokenModel(conn);
        await TokenModel.create({
            userId,
            token: accessToken,
            refreshToken,
            companyDbName: dbName,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token: accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    companyDbName: dbName,
                    organizationName: company.organizationName,
                },
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken: incomingRefresh } = req.body;
        if (!incomingRefresh) {
            res.status(400).json({ success: false, message: "Refresh token required" });
            return;
        }

        let decoded: { userId: string; companyDbName: string };
        try {
            decoded = jwt.verify(incomingRefresh, getRefreshSecret()) as {
                userId: string;
                companyDbName: string;
            };
        } catch {
            res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
            return;
        }

        const conn = getOrgConnection(decoded.companyDbName);
        const TokenModel = getTokenModel(conn);

        const tokenRecord = await TokenModel.findOne({
            refreshToken: incomingRefresh,
            userId: decoded.userId,
        });

        if (!tokenRecord || !tokenRecord.refreshExpiresAt || tokenRecord.refreshExpiresAt < new Date()) {
            res.status(401).json({ success: false, message: "Refresh token expired. Please log in again." });
            return;
        }

        // Get user details to rebuild access token payload
        const UserModel = getUserModel(conn);
        const user = await UserModel.findById(decoded.userId);
        if (!user || !user.isActive) {
            res.status(401).json({ success: false, message: "User not found or inactive" });
            return;
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens({
            userId: decoded.userId,
            email: user.email,
            role: user.role,
            companyDbName: decoded.companyDbName,
        });

        // Rotate: delete old, create new
        await TokenModel.deleteOne({ refreshToken: incomingRefresh });
        await TokenModel.create({
            userId: decoded.userId,
            token: accessToken,
            refreshToken: newRefreshToken,
            companyDbName: decoded.companyDbName,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.json({
            success: true,
            data: { accessToken, refreshToken: newRefreshToken },
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const TokenModel = getTokenModel(conn);
        if (token) await TokenModel.deleteOne({ token });

        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get Me ────────────────────────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const user = await UserModel.findById(userId).select("-password");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const company = await CompanyDetails.findOne({ dbName: companyDbName });

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    companyDbName,
                    organizationName: company?.organizationName,
                },
            },
        });
    } catch (error) {
        console.error("GetMe error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};