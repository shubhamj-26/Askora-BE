import { Server as SocketServer } from "socket.io";
import { Server } from "http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const initSocket = (httpServer: Server): SocketServer => {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5843",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Auth middleware for socket connections
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) {
            return next(new Error("Authentication required"));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as {
                userId: string;
                email: string;
                role: string;
                companyDbName: string;
            };
            socket.data.user = decoded;
            next();
        } catch {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        const { companyDbName, userId, role } = socket.data.user;

        console.log(`🔌 Socket connected: ${userId} [${role}] - Org: ${companyDbName}`);

        // Join org room
        socket.join(companyDbName);
        // Join personal room
        socket.join(`user:${userId}`);

        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${userId}`);
        });

        // Ping/Pong
        socket.on("ping", () => {
            socket.emit("pong", { timestamp: Date.now() });
        });
    });

    return io;
};