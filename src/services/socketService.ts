import { Server as SocketServer } from "socket.io";
import { Server } from "http";
import jwt from "jsonwebtoken";

const getJwtSecret = () => process.env.JWT_SECRET || "askora_dev_secret";

// Track online users per org: orgDbName -> Set of userIds
const onlineUsers: Map<string, Set<string>> = new Map();

export const getOnlineUsers = (companyDbName: string): string[] => {
    return Array.from(onlineUsers.get(companyDbName) || []);
};

export const initSocket = (httpServer: Server): SocketServer => {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5843",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // JWT auth middleware
    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) return next(new Error("Authentication required"));

        try {
            const decoded = jwt.verify(token, getJwtSecret()) as {
                userId: string;
                email: string;
                role: string;
                companyDbName: string;
            };
            socket.data.user = decoded;
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        const { companyDbName, userId, role } = socket.data.user;

        console.log(`🔌 Socket connected: ${userId} [${role}] — org: ${companyDbName}`);

        // Join rooms
        socket.join(companyDbName);
        socket.join(`user:${userId}`);

        // Track online status
        if (!onlineUsers.has(companyDbName)) {
            onlineUsers.set(companyDbName, new Set());
        }
        onlineUsers.get(companyDbName)!.add(userId);

        // Tell all OTHER org members this user is now online
        socket.to(companyDbName).emit("user:online", { userId });

        // Send the joining user the FULL list of currently online users
        // so they can set initial online state correctly
        const currentlyOnline = getOnlineUsers(companyDbName).filter((id) => id !== userId);
        socket.emit("users:online-list", { onlineUserIds: currentlyOnline });

        // Team chat room
        socket.on("chat:enter", () => socket.join(`chat:${companyDbName}`));
        socket.on("chat:leave", () => socket.leave(`chat:${companyDbName}`));

        // Personal chat rooms (deterministic room name: sorted IDs)
        socket.on("personal:enter", (data: { otherUserId: string }) => {
            if (!data?.otherUserId) return;
            const room = `personal:${[userId, data.otherUserId].sort().join("_")}`;
            socket.join(room);
        });
        socket.on("personal:leave", (data: { otherUserId: string }) => {
            if (!data?.otherUserId) return;
            const room = `personal:${[userId, data.otherUserId].sort().join("_")}`;
            socket.leave(room);
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${userId}`);
            // Remove from online tracking
            onlineUsers.get(companyDbName)?.delete(userId);
            // Notify others
            socket.to(companyDbName).emit("user:offline", { userId });
        });

        socket.on("ping", () => socket.emit("pong", { timestamp: Date.now() }));
    });

    return io;
};