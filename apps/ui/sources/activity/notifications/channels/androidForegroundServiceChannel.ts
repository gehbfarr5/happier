export type LiveNotificationServicePayload = Readonly<{
    title: string;
    body: string;
    data?: Record<string, unknown>;
}>;

export async function startForegroundService(_payload: LiveNotificationServicePayload): Promise<void> {
}

export async function updateForegroundService(_payload: LiveNotificationServicePayload): Promise<void> {
}

export async function stopForegroundService(): Promise<void> {
}
