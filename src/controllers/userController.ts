import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getUserModel } from "../models/OrgModels";

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
            res.status(409).json({ success: false, message: "User already exists" });
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
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                },
            },
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

        res.json({ success: true, data: { users } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, isActive, role } = req.body;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        const updateData: Partial<{ name: string; isActive: boolean; role: string }> = {};
        if (name !== undefined) updateData.name = name;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (role !== undefined) updateData.role = role;

        const user = await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        res.json({ success: true, message: "User updated", data: { user } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { companyDbName, userId } = req.user!;

        if (id === userId) {
            res.status(400).json({ success: false, message: "Cannot delete your own account" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const UserModel = getUserModel(conn);

        await UserModel.findByIdAndDelete(id);
        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};