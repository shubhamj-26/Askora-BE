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

// Load .env from project root
const envPaths = [
    path.join(__dirname, "../.env"),
    path.join(process.cwd(), ".env"),
    ".env"
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

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import questionRoutes from "./routes/questions";
import responseRoutes from "./routes/responses";
import beamsRoutes from "./routes/beams";

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5843",
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/beams", beamsRoutes);

// Health check
app.get("/", (_req, res) => {
    res.json({ success: true, message: "🚀 Askora Backend is Running Successfully" });
});
app.get("/api/health", (_req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

// Initialize Socket.IO
const io = initSocket(httpServer);
setQuestionSocketIo(io);
setResponseSocketIo(io);

// Start Server
const PORT = process.env.PORT || 5842;

const startServer = async () => {
    try {
        await connectMainDB();
        httpServer.listen(PORT, () => {
            console.log(`🚀 Askora server running on http://localhost:${PORT}`);
            console.log(`🔌 Socket.IO ready`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();