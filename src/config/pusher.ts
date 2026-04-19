import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

export const getPusher = (): Pusher => {
    if (pusherInstance) return pusherInstance;

    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER || "ap2";

    if (!appId || !key || !secret) {
        throw new Error("Pusher credentials not configured. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET in .env");
    }

    pusherInstance = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
    });

    return pusherInstance;
};

/**
 * Trigger a Pusher channel event (best-effort — errors are logged, never thrown)
 */
export const triggerPusherEvent = async (
    channel: string,
    event: string,
    data: Record<string, unknown>
): Promise<void> => {
    try {
        const pusher = getPusher();
        await pusher.trigger(channel, event, data);
        console.log(`📡 Pusher event "${event}" triggered on "${channel}"`);
    } catch (err) {
        console.warn(`⚠️ Pusher trigger failed for "${event}" on "${channel}":`, err instanceof Error ? err.message : String(err));
    }
};