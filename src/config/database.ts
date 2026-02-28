import mongoose, { Connection } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

// Main connection (for company_details)
let mainConnection: typeof mongoose | null = null;

// Cache for org-specific connections
const orgConnections: Map<string, Connection> = new Map();

export const connectMainDB = async (): Promise<void> => {
    try {
        if (mainConnection) return;
        await mongoose.connect(MONGODB_URI + "askora_main");
        mainConnection = mongoose;
        console.log("✅ Connected to main database: askora_main");
    } catch (error) {
        console.error("❌ Main DB connection failed:", error);
        throw error;
    }
};

export const getOrgConnection = (dbName: string): Connection => {
    if (orgConnections.has(dbName)) {
        return orgConnections.get(dbName) as Connection;
    }

    const conn = mongoose.createConnection(MONGODB_URI + dbName);
    conn.on("connected", () => console.log(`✅ Connected to org DB: ${dbName}`));
    conn.on("error", (err) => console.error(`❌ Org DB error [${dbName}]:`, err));
    orgConnections.set(dbName, conn);
    return conn;
};

export default mongoose;