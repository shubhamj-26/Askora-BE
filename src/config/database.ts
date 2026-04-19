import mongoose, { Connection } from "mongoose";

// Main connection (for company_details)
let mainConnection: typeof mongoose | null = null;

// Cache for org-specific connections
const orgConnections: Map<string, Connection> = new Map();

export const connectMainDB = async (): Promise<void> => {
    try {
        // Read environment variable when function is called (after dotenv.config())
        const MONGODB_URI = process.env.MONGODB_URI as string;

        if (!MONGODB_URI) {
            throw new Error("MONGODB_URI environment variable is not set");
        }

        if (mainConnection) return;
        const mainDbUri = `${MONGODB_URI}askora_main`;
        await mongoose.connect(mainDbUri);
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

    // Read environment variable when function is called
    const MONGODB_URI = process.env.MONGODB_URI as string;

    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI environment variable is not set");
    }

    const orgDbUri = `${MONGODB_URI}${dbName}`;
    const conn = mongoose.createConnection(orgDbUri);
    conn.on("connected", () => console.log(`✅ Connected to org DB: ${dbName}`));
    conn.on("error", (err) => console.error(`❌ Org DB error [${dbName}]:`, err));
    orgConnections.set(dbName, conn);
    return conn;
};

export default mongoose;