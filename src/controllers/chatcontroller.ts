import { Response } from "express";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getChatMessageModel } from "../models/OrgModels";
import { Server as SocketServer } from "socket.io";

let ioInstance: SocketServer | null = null;

export const setSocketIo = (io: SocketServer): void => {
    ioInstance = io;
};

// ── Get team messages ──────────────────────────────────────────────────────────
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { companyDbName } = req.user!;
        const limit = parseInt(req.query.limit as string) || 50;
        const before = req.query.before as string | undefined;

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        const query: Record<string, unknown> = { chatType: "team" };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await ChatModel.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json({ success: true, data: { messages: messages.reverse() } });
    } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Send team message ──────────────────────────────────────────────────────────
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { message } = req.body;
        const { userId, email, companyDbName } = req.user!;

        if (!message?.trim()) {
            res.status(400).json({ success: false, message: "Message cannot be empty" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        const { getUserModel } = await import("../models/OrgModels");
        const UserModel = getUserModel(conn);
        const user = await UserModel.findById(userId);

        const chatMessage = await ChatModel.create({
            companyDbName,
            chatType: "team",
            senderId: userId,
            senderName: user?.name || email,
            senderEmail: email,
            message: message.trim(),
            readBy: [userId],
        });

        // Broadcast to all org members
        if (ioInstance) {
            ioInstance.to(companyDbName).emit("chat:message", chatMessage);
        }

        res.status(201).json({ success: true, data: { message: chatMessage } });
    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get personal messages between two users ────────────────────────────────────
export const getPersonalMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName } = req.user!;
        const { receiverId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const before = req.query.before as string | undefined;

        if (!receiverId) {
            res.status(400).json({ success: false, message: "receiverId is required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        // Get messages between these two users in either direction
        const query: Record<string, unknown> = {
            chatType: "personal",
            $or: [
                { senderId: userId, receiverId },
                { senderId: receiverId, receiverId: userId },
            ],
        };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await ChatModel.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json({ success: true, data: { messages: messages.reverse() } });
    } catch (error) {
        console.error("Get personal messages error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Send personal message ──────────────────────────────────────────────────────
export const sendPersonalMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { message, receiverId } = req.body;
        const { userId, email, companyDbName } = req.user!;

        if (!message?.trim()) {
            res.status(400).json({ success: false, message: "Message cannot be empty" });
            return;
        }
        if (!receiverId) {
            res.status(400).json({ success: false, message: "receiverId is required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        const { getUserModel } = await import("../models/OrgModels");
        const UserModel = getUserModel(conn);
        const [sender, receiver] = await Promise.all([
            UserModel.findById(userId),
            UserModel.findById(receiverId),
        ]);

        if (!receiver) {
            res.status(404).json({ success: false, message: "Recipient not found" });
            return;
        }

        const chatMessage = await ChatModel.create({
            companyDbName,
            chatType: "personal",
            senderId: userId,
            senderName: sender?.name || email,
            senderEmail: email,
            receiverId,
            receiverName: receiver.name,
            message: message.trim(),
            readBy: [userId],
        });

        // Emit to both participants via their personal socket rooms
        if (ioInstance) {
            // Personal room name: sorted IDs joined, so both sides use same room
            const roomName = `personal:${[userId, receiverId].sort().join("_")}`;
            ioInstance.to(roomName).emit("chat:personal", chatMessage);

            // Also notify receiver in their user room (for unread badge)
            ioInstance.to(`user:${receiverId}`).emit("chat:personal:notify", {
                from: { id: userId, name: sender?.name || email },
                message: chatMessage,
            });
        }

        res.status(201).json({ success: true, data: { message: chatMessage } });
    } catch (error) {
        console.error("Send personal message error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Mark messages as read ──────────────────────────────────────────────────────
export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName } = req.user!;
        const { senderId } = req.body; // optional: for personal chat mark-read

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        const filter: Record<string, unknown> = {
            companyDbName,
            readBy: { $ne: userId },
        };

        if (senderId) {
            // Mark personal messages from this sender as read
            filter.chatType = "personal";
            filter.senderId = senderId;
            filter.receiverId = userId;
        } else {
            // Mark team messages as read
            filter.chatType = "team";
        }

        await ChatModel.updateMany(filter, { $addToSet: { readBy: userId } });

        res.json({ success: true, message: "Messages marked as read" });
    } catch (error) {
        console.error("Mark read error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get unread counts per sender ────────────────────────────────────────────────
export const getUnreadCounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const ChatModel = getChatMessageModel(conn);

        const unread = await ChatModel.aggregate([
            {
                $match: {
                    companyDbName,
                    chatType: "personal",
                    receiverId: userId,
                    readBy: { $ne: userId },
                },
            },
            {
                $group: {
                    _id: "$senderId",
                    count: { $sum: 1 },
                },
            },
        ]);

        const counts: Record<string, number> = {};
        unread.forEach((u: { _id: string; count: number }) => {
            counts[u._id] = u.count;
        });

        res.json({ success: true, data: { unreadCounts: counts } });
    } catch (error) {
        console.error("Get unread counts error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};