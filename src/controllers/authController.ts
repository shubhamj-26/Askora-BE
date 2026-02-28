import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CompanyDetails } from "../models/CompanyDetails";
import { getOrgConnection } from "../config/database";
import { getUserModel, getTokenModel } from "../models/OrgModels";
import { SignupPayload, LoginPayload, AuthRequest } from "../types/index";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Helper: derive DB name from email domain
// shubham.jadhav@ndsofttech.com → ndsofttech_com
const getDbNameFromEmail = (email: string): string => {
    const domain = email.split("@")[1];
    return domain.replace(/\./g, "_");
};

export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, organizationName }: SignupPayload = req.body;

        if (!name || !email || !password || !organizationName) {
            res.status(400).json({ success: false, message: "All fields are required" });
            return;
        }

        const domainName = email.split("@")[1];
        const dbName = getDbNameFromEmail(email);

        // Check if company already exists
        const existing = await CompanyDetails.findOne({ adminEmail: email });
        if (existing) {
            res.status(409).json({ success: false, message: "Organization already registered with this email" });
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

        // Generate token
        const jwtSecret = process.env.JWT_SECRET || "secret";
        const token = jwt.sign(
            { userId: adminUser._id?.toString(), email, role: "admin", companyDbName: dbName },
            jwtSecret,
            { expiresIn: JWT_EXPIRES_IN } as any
        );

        // Store token in DB
        const TokenModel = getTokenModel(conn);
        await TokenModel.create({
            userId: adminUser._id?.toString(),
            token,
            companyDbName: dbName,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.status(201).json({
            success: true,
            message: "Organization registered successfully",
            data: {
                token,
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

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password }: LoginPayload = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password required" });
            return;
        }

        const dbName = getDbNameFromEmail(email);

        // Verify company exists
        const company = await CompanyDetails.findOne({ dbName });
        if (!company) {
            res.status(404).json({ success: false, message: "Organization not found" });
            return;
        }

        // Find user in org DB
        const conn = getOrgConnection(dbName);
        const UserModel = getUserModel(conn);

        const user = await UserModel.findOne({ email, isActive: true });
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        // Generate token
        const jwtSecret = process.env.JWT_SECRET || "secret";
        const token = jwt.sign(
            { userId: user._id?.toString(), email, role: user.role, companyDbName: dbName },
            jwtSecret,
            { expiresIn: JWT_EXPIRES_IN } as any
        );

        // Store token
        const TokenModel = getTokenModel(conn);
        await TokenModel.create({
            userId: user._id?.toString(),
            token,
            companyDbName: dbName,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token,
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

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const TokenModel = getTokenModel(conn);
        await TokenModel.deleteOne({ token });

        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

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
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};