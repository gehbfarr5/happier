import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    startForegroundService: vi.fn(),
    stopForegroundService: vi.fn(),
    updateForegroundService: vi.fn(),
}));

vi.mock('@/activity/notifications/channels/androidForegroundServiceChannel', () => ({
    startForegroundService: (...args: unknown[]) => mocks.startForegroundService(...args),
    stopForegroundService: (...args: unknown[]) => mocks.stopForegroundService(...args),
    updateForegroundService: (...args: unknown[]) => mocks.updateForegroundService(...args),
}));

async function loadModuleWithPlatform(platformOs: 'android' | 'ios' | 'web') {
    vi.doMock('react-native', async () => {
        const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
        return createReactNativeWebMock({
            Platform: { OS: platformOs },
        });
    });
    return import('./liveNotificationService');
}

describe('liveNotificationService', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.startForegroundService.mockClear();
        mocks.stopForegroundService.mockClear();
        mocks.updateForegroundService.mockClear();
    });

    describe('isLiveNotificationServiceSupported', () => {
        it('returns true on Android', async () => {
            const { isLiveNotificationServiceSupported } = await loadModuleWithPlatform('android');
            expect(isLiveNotificationServiceSupported()).toBe(true);
        });

        it('returns false on iOS', async () => {
            const { isLiveNotificationServiceSupported } = await loadModuleWithPlatform('ios');
            expect(isLiveNotificationServiceSupported()).toBe(false);
        });

        it('returns false on web', async () => {
            const { isLiveNotificationServiceSupported } = await loadModuleWithPlatform('web');
            expect(isLiveNotificationServiceSupported()).toBe(false);
        });
    });

    describe('startLiveNotificationService', () => {
        it('calls Android foreground service on Android platform', async () => {
            mocks.startForegroundService.mockResolvedValueOnce(undefined);
            const { startLiveNotificationService } = await loadModuleWithPlatform('android');

            await startLiveNotificationService({
                title: 'Session Active',
                body: 'Running task...',
                sessionId: 'session-123',
            });

            expect(mocks.startForegroundService).toHaveBeenCalledWith({
                title: 'Session Active',
                body: 'Running task...',
                data: { sessionId: 'session-123' },
            });
        });

        it('is a no-op on non-Android platforms', async () => {
            const { startLiveNotificationService } = await loadModuleWithPlatform('ios');

            await startLiveNotificationService({
                title: 'Session Active',
                body: 'Running task...',
                sessionId: 'session-123',
            });

            expect(mocks.startForegroundService).not.toHaveBeenCalled();
        });

        it('is a no-op on web platform', async () => {
            const { startLiveNotificationService } = await loadModuleWithPlatform('web');

            await startLiveNotificationService({
                title: 'Session Active',
                body: 'Running task...',
                sessionId: 'session-123',
            });

            expect(mocks.startForegroundService).not.toHaveBeenCalled();
        });
    });

    describe('updateLiveNotificationService', () => {
        it('calls Android foreground service update on Android platform', async () => {
            mocks.updateForegroundService.mockResolvedValueOnce(undefined);
            const { updateLiveNotificationService } = await loadModuleWithPlatform('android');

            await updateLiveNotificationService({
                title: 'Updated Title',
                body: 'New status...',
            });

            expect(mocks.updateForegroundService).toHaveBeenCalledWith({
                title: 'Updated Title',
                body: 'New status...',
            });
        });

        it('is a no-op on non-Android platforms', async () => {
            const { updateLiveNotificationService } = await loadModuleWithPlatform('ios');

            await updateLiveNotificationService({
                title: 'Updated Title',
                body: 'New status...',
            });

            expect(mocks.updateForegroundService).not.toHaveBeenCalled();
        });
    });

    describe('stopLiveNotificationService', () => {
        it('calls Android foreground service stop on Android platform', async () => {
            mocks.stopForegroundService.mockResolvedValueOnce(undefined);
            const { stopLiveNotificationService } = await loadModuleWithPlatform('android');

            await stopLiveNotificationService();

            expect(mocks.stopForegroundService).toHaveBeenCalled();
        });

        it('is a no-op on non-Android platforms', async () => {
            const { stopLiveNotificationService } = await loadModuleWithPlatform('ios');

            await stopLiveNotificationService();

            expect(mocks.stopForegroundService).not.toHaveBeenCalled();
        });
    });
});
