import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getUserModel } from "../models/OrgModels";

// Helper to safely map user document → plain object with `id`
const mapUser = (u: {
    _id?: unknown;
    id?: unknown;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    companyDbName: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}) => ({
    id: u._id?.toString() ?? u.id?.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    companyDbName: u.companyDbName,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
});

export const addUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, email, password, role = "user" } = req.body;
        const { companyDbName } = req.user!;

        if (!name || !email || !password) {
            res.status(400).json({ success: false, message: "Name, email and password required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const existing = await UserModel.findOne({ email });
        if (existing) {
            res.status(409).json({ success: false, message: "User already exists with this email" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await UserModel.create({
            name,
            email,
            password: hashedPassword,
            role: role === "admin" ? "admin" : "user",
            companyDbName,
            isActive: true,
        });

        res.status(201).json({
            success: true,
            message: "User added successfully",
            data: { user: mapUser(user) },
        });
    } catch (error) {
        console.error("Add user error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const users = await UserModel.find({}).select("-password").sort({ createdAt: -1 });

        res.json({
            success: true,
            data: { users: users.map(mapUser) },
        });
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, email, isActive, role } = req.body;
        const { companyDbName } = req.user!;

        if (!id || id === "undefined") {
            res.status(400).json({ success: false, message: "Valid user ID is required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const updateData: Partial<{ name: string; email: string; isActive: boolean; role: string }> = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) {
            // Validate email uniqueness (exclude current user)
            const existing = await UserModel.findOne({ email, _id: { $ne: id } });
            if (existing) {
                res.status(409).json({ success: false, message: "Email already in use" });
                return;
            }
            updateData.email = email;
        }
        if (isActive !== undefined) updateData.isActive = isActive;
        if (role !== undefined) updateData.role = role;

        const user = await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        res.json({ success: true, message: "User updated", data: { user: mapUser(user) } });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { companyDbName, userId } = req.user!;

        if (!id || id === "undefined") {
            res.status(400).json({ success: false, message: "Valid user ID is required" });
            return;
        }

        if (id === userId) {
            res.status(400).json({ success: false, message: "You cannot delete your own account" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const deleted = await UserModel.findByIdAndDelete(id);
        if (!deleted) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};