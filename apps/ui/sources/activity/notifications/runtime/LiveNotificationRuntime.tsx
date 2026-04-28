import * as React from 'react';

import { useLocalSettings, storage } from '@/sync/domains/state/storage';
import { aggregateActiveSessionsForNotification } from '../sessionAggregation';
import {
    startLiveNotificationService,
    stopLiveNotificationService,
    updateLiveNotificationService,
    isLiveNotificationServiceSupported,
} from '../liveNotificationService';

/**
 * Runtime component that manages the Android foreground service for live notifications.
 * When keepAliveInBackgroundEnabled is true and there are active sessions, starts a foreground
 * notification that keeps the app alive in the background. Updates notification content when
 * sessions change, and stops the service when disabled or no sessions are active.
 */
export function LiveNotificationRuntime(): React.ReactElement | null {
    const localSettings = useLocalSettings();

    const keepAliveEnabled = localSettings.keepAliveInBackgroundEnabled === true;
    const isSupported = isLiveNotificationServiceSupported();

    // Track whether service is currently running to avoid redundant start/stop calls
    const isRunningRef = React.useRef(false);

    // Derive aggregated session summary for notification content
    // Read sessions directly from storage to avoid subscription overhead for this background service
    const aggregated = React.useMemo(() => {
        const sessions = storage.getState().sessions;
        if (!sessions) return [];
        return aggregateActiveSessionsForNotification(sessions);
    }, [localSettings]); // Re-compute when local settings change; sessions are read fresh from storage

    // Determine if we should be running the service
    const shouldBeRunning = isSupported && keepAliveEnabled && aggregated.length > 0;

    // Get the first session for notification content (or null if none)
    const primarySession = aggregated.length > 0 && 'sessionId' in aggregated[0] ? aggregated[0] : null;

    React.useEffect(() => {
        if (shouldBeRunning && !isRunningRef.current && primarySession) {
            // Start the service
            isRunningRef.current = true;
            startLiveNotificationService({
                title: primarySession.title,
                body: primarySession.status === 'running' ? 'Running task...' : 'Session active',
                sessionId: primarySession.sessionId,
            }).catch(() => {
                // Ignore errors - best effort
            });
        } else if (!shouldBeRunning && isRunningRef.current) {
            // Stop the service
            isRunningRef.current = false;
            stopLiveNotificationService().catch(() => {
                // Ignore errors - best effort
            });
        } else if (shouldBeRunning && isRunningRef.current && primarySession) {
            // Update the notification content
            updateLiveNotificationService({
                title: primarySession.title,
                body: primarySession.status === 'running' ? 'Running task...' : 'Session active',
            }).catch(() => {
                // Ignore errors - best effort
            });
        }
    }, [shouldBeRunning, primarySession]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (isRunningRef.current) {
                stopLiveNotificationService().catch(() => {
                    // Ignore errors - best effort
                });
                isRunningRef.current = false;
            }
        };
    }, []);

    return null;
}
