import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ES modules: get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (try multiple paths)
const envPaths = [
    path.join(__dirname, "../.env"),
    path.join(process.cwd(), ".env"),
    ".env",
];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
    }
}

import { connectMainDB } from "./config/database";
import { initSocket } from "./services/socketService";
import { setSocketIo as setQuestionSocketIo } from "./controllers/questionController";
import { setSocketIo as setResponseSocketIo } from "./controllers/responseController";
import { setSocketIo as setChatSocketIo } from "./controllers/chatController";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import questionRoutes from "./routes/questions";
import responseRoutes from "./routes/responses";
import beamsRoutes from "./routes/beams";
import chatRoutes from "./routes/chat";

const app = express();
const httpServer = createServer(app);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5843",
    "http://localhost:5173",
    "http://localhost:3000",
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, Postman)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin "${origin}" not allowed`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/beams", beamsRoutes);
app.use("/api/chat", chatRoutes);

// Health check
app.get("/", (_req, res) => {
    res.json({ success: true, message: "🚀 Askora Backend is Running" });
});
app.get("/api/health", (_req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = initSocket(httpServer);
setQuestionSocketIo(io);
setResponseSocketIo(io);
setChatSocketIo(io);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5842;

const startServer = async () => {
    try {
        await connectMainDB();
        httpServer.listen(PORT, () => {
            console.log(`🚀 Askora server → http://localhost:${PORT}`);
            console.log(`🔌 Socket.IO ready`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();