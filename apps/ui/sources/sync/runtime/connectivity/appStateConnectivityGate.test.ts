import { describe, expect, it, vi } from 'vitest';

import { applyInitialAppStateConnectivityGate } from './appStateConnectivityGate';

describe('applyInitialAppStateConnectivityGate', () => {
    it('disables network and pauses when background and keep alive disabled', () => {
        const pause = vi.fn();
        const setNetworkAllowed = vi.fn();

        applyInitialAppStateConnectivityGate({
            isForeground: false,
            keepAliveInBackgroundEnabled: false,
            pauseController: { pause },
            setNetworkAllowed,
        });

        expect(setNetworkAllowed).toHaveBeenCalledWith(false);
        expect(pause).toHaveBeenCalledTimes(1);
    });

    it('enables network and does not pause when foreground', () => {
        const pause = vi.fn();
        const setNetworkAllowed = vi.fn();

        applyInitialAppStateConnectivityGate({
            isForeground: true,
            keepAliveInBackgroundEnabled: false,
            pauseController: { pause },
            setNetworkAllowed,
        });

        expect(setNetworkAllowed).toHaveBeenCalledWith(true);
        expect(pause).not.toHaveBeenCalled();
    });

    it('keeps network enabled and does not pause when background and keep alive enabled', () => {
        const pause = vi.fn();
        const setNetworkAllowed = vi.fn();

        applyInitialAppStateConnectivityGate({
            isForeground: false,
            keepAliveInBackgroundEnabled: true,
            pauseController: { pause },
            setNetworkAllowed,
        });

        expect(setNetworkAllowed).toHaveBeenCalledWith(true);
        expect(pause).not.toHaveBeenCalled();
    });
});
