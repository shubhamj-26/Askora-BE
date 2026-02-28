const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Default Route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "🚀 Askora Backend is Running Successfully"
    });
});

// Example API Route
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        uptime: process.uptime()
    });
});

// Port Configuration
const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});