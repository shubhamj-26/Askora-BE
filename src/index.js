import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { connectMainDB } from "./config/database.js";
import { initSocket } from "./services/socketService.js";
import { setSocketIo as setQuestionSocketIo } from "./controllers/questionController.js";
import { setSocketIo as setResponseSocketIo } from "./controllers/responseController.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import questionRoutes from "./routes/questions.js";
import responseRoutes from "./routes/responses.js";
import beamsRoutes from "./routes/beams.js";

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