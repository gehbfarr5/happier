import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

type ReactActEnvironmentGlobal = typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
};
(globalThis as ReactActEnvironmentGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
    platformOs: 'android' as 'android' | 'ios' | 'web',
    routerPush: vi.fn(),
    getLastNotificationResponseAsync: vi.fn(),
    addNotificationResponseReceivedListener: vi.fn((_: (response: unknown) => void) => ({ remove: vi.fn() })),
    clearLastNotificationResponseAsync: vi.fn(),
    getActiveServerUrl: 'https://stack.example.test',
    listServerProfiles: [] as Array<{ id: string; serverUrl: string }>,
    getPendingNotificationNav: null as { serverUrl: string; route: string } | null,
    getPendingNotificationAction: null as { serverUrl: string; sessionId: string; requestId: string; action: 'allow' | 'deny' } | null,
    refreshAuth: vi.fn(),
}));

vi.mock('expo-router', () => ({
    router: {
        push: mocks.routerPush,
    },
}));

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        Platform: {
            get OS() {
                return mocks.platformOs;
            },
        },
    });
});

vi.mock('expo-notifications', () => ({
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    getLastNotificationResponseAsync: mocks.getLastNotificationResponseAsync,
    addNotificationResponseReceivedListener: mocks.addNotificationResponseReceivedListener,
}));

vi.mock('@/sync/domains/server/serverProfiles', () => ({
    getActiveServerUrl: () => mocks.getActiveServerUrl,
    listServerProfiles: () => mocks.listServerProfiles,
}));

vi.mock('@/sync/domains/server/activeServerSwitch', () => ({
    normalizeServerUrl: (url: string) => url?.replace(/\/$/, '') || null,
    setActiveServerAndSwitch: vi.fn(),
    upsertActivateAndSwitchServer: vi.fn(),
}));

vi.mock('@/sync/domains/server/url/serverUrlCanonical', () => ({
    createServerUrlComparableKey: (url: string) => url?.replace(/\/$/, '') || null,
}));

vi.mock('@/sync/domains/pending/pendingNotificationNav', () => ({
    getPendingNotificationNav: () => mocks.getPendingNotificationNav,
    setPendingNotificationNav: vi.fn(),
    clearPendingNotificationNav: vi.fn(),
}));

vi.mock('@/sync/domains/pending/pendingNotificationAction', () => ({
    getPendingNotificationAction: () => mocks.getPendingNotificationAction,
    setPendingNotificationAction: vi.fn(),
    clearPendingNotificationAction: vi.fn(),
}));

vi.mock('@/sync/ops', () => ({
    sessionAllow: vi.fn(),
    sessionDeny: vi.fn(),
}));

vi.mock('@/utils/system/fireAndForget', () => ({
    fireAndForget: (promise: Promise<unknown>) => promise.catch(() => {}),
}));

function createNotificationResponse(params: {
    actionIdentifier?: string;
    sessionId: string;
    serverUrl?: string;
    requestId?: string;
}) {
    const {
        actionIdentifier = 'expo.modules.notifications.actions.DEFAULT',
        sessionId,
        serverUrl = 'https://stack.example.test',
        requestId,
    } = params;

    return {
        actionIdentifier,
        notification: {
            request: {
                identifier: 'notification-123',
                content: {
                    data: {
                        sessionId,
                        serverUrl,
                        ...(requestId ? { requestId } : {}),
                    },
                },
            },
        },
    };
}

describe('useNotificationResponseRouting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.platformOs = 'android';
        mocks.getActiveServerUrl = 'https://stack.example.test';
        mocks.listServerProfiles = [];
        mocks.getPendingNotificationNav = null;
        mocks.getPendingNotificationAction = null;
        mocks.getLastNotificationResponseAsync.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('live notification tap routing', () => {
        it('navigates to session page when live notification with sessionId is tapped', async () => {
            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            const response = createNotificationResponse({
                sessionId: 'session-live-123',
                serverUrl: 'https://stack.example.test',
            });

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(response);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: true,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            // Wait for async getLastNotificationResponseAsync to resolve
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            expect(mocks.routerPush).toHaveBeenCalledWith('/session/session-live-123');
        });

        it('encodes sessionId in the route path', async () => {
            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            const response = createNotificationResponse({
                sessionId: 'session/with/slashes',
                serverUrl: 'https://stack.example.test',
            });

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(response);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: true,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            expect(mocks.routerPush).toHaveBeenCalledWith('/session/session%2Fwith%2Fslashes');
        });

        it('does not navigate when notification lacks sessionId', async () => {
            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            const response = {
                actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
                notification: {
                    request: {
                        identifier: 'notification-456',
                        content: {
                            data: {
                                serverUrl: 'https://stack.example.test',
                            },
                        },
                    },
                },
            };

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(response);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: true,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            expect(mocks.routerPush).not.toHaveBeenCalled();
        });

        it('handles real-time notification response via listener', async () => {
            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            let capturedListener: ((response: unknown) => void) | null = null;
            mocks.addNotificationResponseReceivedListener.mockImplementation((listener: (response: unknown) => void) => {
                capturedListener = listener;
                return { remove: vi.fn() };
            });

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(null);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: true,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            expect(capturedListener).not.toBeNull();

            // Simulate a live notification tap
            const response = createNotificationResponse({
                sessionId: 'session-realtime-789',
                serverUrl: 'https://stack.example.test',
            });

            await act(async () => {
                capturedListener?.(response);
            });

            expect(mocks.routerPush).toHaveBeenCalledWith('/session/session-realtime-789');
        });

        it('does not navigate on web platform', async () => {
            mocks.platformOs = 'web';

            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            const response = createNotificationResponse({
                sessionId: 'session-web-123',
                serverUrl: 'https://stack.example.test',
            });

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(response);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: true,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            expect(mocks.routerPush).not.toHaveBeenCalled();
        });

        it('does nothing when hook is disabled', async () => {
            const { useNotificationResponseRouting } = await import('./useNotificationResponseRouting');

            const response = createNotificationResponse({
                sessionId: 'session-disabled-123',
                serverUrl: 'https://stack.example.test',
            });

            mocks.getLastNotificationResponseAsync.mockResolvedValueOnce(response);

            const TestComponent = () => {
                useNotificationResponseRouting({
                    enabled: false,
                    refreshAuth: mocks.refreshAuth,
                });
                return null;
            };

            await act(async () => {
                renderer.create(<TestComponent />);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            expect(mocks.routerPush).not.toHaveBeenCalled();
        });
    });
});
