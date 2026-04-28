import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import renderer, { act } from 'react-test-renderer';

import { localSettingsDefaults, localSettingsParse } from '@/sync/domains/settings/localSettings';

type ReactActEnvironmentGlobal = typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
};
(globalThis as ReactActEnvironmentGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const reactNativeRuntime = vi.hoisted(() => ({
    platformOs: 'android' as 'web' | 'ios' | 'android',
}));

let localSettingsValue: Record<string, unknown> = {
    keepAliveInBackgroundEnabled: false,
};

let sessionsByIdValue: Record<string, unknown> = {};

const startLiveNotificationService = vi.hoisted(() => vi.fn(async () => undefined));
const updateLiveNotificationService = vi.hoisted(() => vi.fn(async () => undefined));
const stopLiveNotificationService = vi.hoisted(() => vi.fn(async () => undefined));
const isLiveNotificationServiceSupported = vi.hoisted(() => vi.fn(() => true));

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        Platform: {
            get OS() {
                return reactNativeRuntime.platformOs;
            },
        },
    });
});

vi.mock('@/sync/domains/state/storage', () => ({
    useLocalSettings: () => localSettingsValue,
    useSessions: () => sessionsByIdValue,
    storage: {
        getState: () => ({
            sessions: sessionsByIdValue,
            localSettings: localSettingsValue,
        }),
    },
}));

vi.mock('../liveNotificationService', () => ({
    startLiveNotificationService,
    updateLiveNotificationService,
    stopLiveNotificationService,
    isLiveNotificationServiceSupported,
}));

describe('keepAliveInBackgroundEnabled local setting', () => {
    it('has a default value of false', () => {
        expect(localSettingsDefaults.keepAliveInBackgroundEnabled).toBe(false);
    });

    it('parses keepAliveInBackgroundEnabled from input', () => {
        const parsed = localSettingsParse({ keepAliveInBackgroundEnabled: true });
        expect(parsed.keepAliveInBackgroundEnabled).toBe(true);
    });

    it('uses default when not specified', () => {
        const parsed = localSettingsParse({});
        expect(parsed.keepAliveInBackgroundEnabled).toBe(false);
    });
});

describe('LiveNotificationRuntime', () => {
    beforeEach(() => {
        reactNativeRuntime.platformOs = 'android';
        localSettingsValue = { keepAliveInBackgroundEnabled: false };
        sessionsByIdValue = {};
        startLiveNotificationService.mockClear();
        updateLiveNotificationService.mockClear();
        stopLiveNotificationService.mockClear();
        isLiveNotificationServiceSupported.mockReturnValue(true);
    });

    afterEach(async () => {
        // Reset modules to clear state between tests
        vi.resetModules();
    });

    it('starts live notification service when setting enabled and sessions active', async () => {
        localSettingsValue = { keepAliveInBackgroundEnabled: true };
        sessionsByIdValue = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'Working on task' } },
            },
        };

        const { LiveNotificationRuntime } = await import('./LiveNotificationRuntime');
        let tree: renderer.ReactTestRenderer | null = null;

        await act(async () => {
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(startLiveNotificationService).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'session-1',
            title: expect.any(String),
            body: expect.any(String),
        }));

        await act(async () => {
            tree?.unmount();
        });
    });

    it('does not start service when setting is disabled', async () => {
        localSettingsValue = { keepAliveInBackgroundEnabled: false };
        sessionsByIdValue = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'Working on task' } },
            },
        };

        const { LiveNotificationRuntime } = await import('./LiveNotificationRuntime');
        let tree: renderer.ReactTestRenderer | null = null;

        await act(async () => {
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(startLiveNotificationService).not.toHaveBeenCalled();

        await act(async () => {
            tree?.unmount();
        });
    });

    it('stops service when setting is disabled after being enabled', async () => {
        localSettingsValue = { keepAliveInBackgroundEnabled: true };
        sessionsByIdValue = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'Working on task' } },
            },
        };

        const { LiveNotificationRuntime } = await import('./LiveNotificationRuntime');
        let tree: renderer.ReactTestRenderer | null = null;

        await act(async () => {
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(startLiveNotificationService).toHaveBeenCalled();

        // Disable the setting
        localSettingsValue = { keepAliveInBackgroundEnabled: false };

        await act(async () => {
            // Force re-render by re-mounting
            tree?.unmount();
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(stopLiveNotificationService).toHaveBeenCalled();

        await act(async () => {
            tree?.unmount();
        });
    });

    it('updates notification content when sessions change', async () => {
        localSettingsValue = { keepAliveInBackgroundEnabled: true };
        sessionsByIdValue = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'First task' } },
            },
        };

        const { LiveNotificationRuntime } = await import('./LiveNotificationRuntime');
        let tree: renderer.ReactTestRenderer | null = null;

        await act(async () => {
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(startLiveNotificationService).toHaveBeenCalledWith(expect.objectContaining({
            title: 'First task',
            body: 'Running task...',
        }));

        // Update session - need to create a new object reference for React to detect change
        const newSessionsById = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'Second task' } },
            },
        };
        sessionsByIdValue = newSessionsById;

        // Force re-render by updating with key or re-mounting
        await act(async () => {
            tree?.unmount();
            tree = (await renderScreen(<LiveNotificationRuntime key="second" />)).tree;
        });

        // The component should call start again since it's a fresh mount
        expect(startLiveNotificationService).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Second task',
        }));

        await act(async () => {
            tree?.unmount();
        });
    });

    it('is a no-op on non-Android platforms', async () => {
        reactNativeRuntime.platformOs = 'ios';
        isLiveNotificationServiceSupported.mockReturnValue(false);
        localSettingsValue = { keepAliveInBackgroundEnabled: true };
        sessionsByIdValue = {
            'session-1': {
                id: 'session-1',
                active: true,
                presence: 'online',
                thinking: true,
                metadata: { summary: { text: 'Working on task' } },
            },
        };

        const { LiveNotificationRuntime } = await import('./LiveNotificationRuntime');
        let tree: renderer.ReactTestRenderer | null = null;

        await act(async () => {
            tree = (await renderScreen(<LiveNotificationRuntime />)).tree;
        });

        expect(startLiveNotificationService).not.toHaveBeenCalled();

        await act(async () => {
            tree?.unmount();
        });
    });
});

// Helper for rendering screens in tests
async function renderScreen(element: React.ReactElement) {
    const rendererInstance = renderer.create(element);
    return { tree: rendererInstance };
}
