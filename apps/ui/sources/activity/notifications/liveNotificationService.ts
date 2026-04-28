import { Platform } from 'react-native';

import type { LiveNotificationServicePayload } from './channels/androidForegroundServiceChannel';

export { type LiveNotificationServicePayload } from './channels/androidForegroundServiceChannel';

export function isLiveNotificationServiceSupported(): boolean {
    return Platform.OS === 'android';
}

export async function startLiveNotificationService(payload: Readonly<{
    title: string;
    body: string;
    sessionId: string;
}>): Promise<void> {
    if (!isLiveNotificationServiceSupported()) {
        return;
    }

    const { startForegroundService } = await import('./channels/androidForegroundServiceChannel');
    await startForegroundService({
        title: payload.title,
        body: payload.body,
        data: { sessionId: payload.sessionId },
    });
}

export async function updateLiveNotificationService(payload: Readonly<{
    title: string;
    body: string;
}>): Promise<void> {
    if (!isLiveNotificationServiceSupported()) {
        return;
    }

    const { updateForegroundService } = await import('./channels/androidForegroundServiceChannel');
    await updateForegroundService({
        title: payload.title,
        body: payload.body,
    });
}

export async function stopLiveNotificationService(): Promise<void> {
    if (!isLiveNotificationServiceSupported()) {
        return;
    }

    const { stopForegroundService } = await import('./channels/androidForegroundServiceChannel');
    await stopForegroundService();
}
