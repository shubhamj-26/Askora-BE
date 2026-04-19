import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

export const getPusher = (): Pusher => {
    if (!pusherInstance) {
        pusherInstance = new Pusher({
            appId: process.env.PUSHER_APP_ID || "",
            key: process.env.PUSHER_KEY || "",
            secret: process.env.PUSHER_SECRET || "",
            cluster: process.env.PUSHER_CLUSTER || "ap2",
            useTLS: true,
        });
    }
    return pusherInstance;
};

// Pusher Beams - server-side notification trigger helper
// Actual Beams SDK is initialized client-side via SDK
// Server sends auth tokens and triggers via REST
export const triggerPusherEvent = async (
    channel: string,
    event: string,
    data: Record<string, unknown>
): Promise<void> => {
    try {
        const pusher = getPusher();
        await pusher.trigger(channel, event, data);
    } catch (error) {
        console.error("Pusher trigger error:", error);
    }
};