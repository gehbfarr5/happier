import type { Session } from '@/sync/domains/state/storageTypes';

export type AggregatedSessionSummary = {
    sessionId: string;
    title: string;
    status: 'running' | 'idle';
};

export type AggregatedSessionsResult = Array<AggregatedSessionSummary | { remainingCount: number }>;

function resolveSessionTitle(session: Session): string {
    const summaryText = typeof session?.metadata?.summary?.text === 'string'
        ? session.metadata.summary.text.trim()
        : '';
    if (summaryText) return summaryText;
    return session.id;
}

function isSessionActiveAndOnline(session: Session): boolean {
    return session.active === true && session.presence === 'online';
}

function getSessionDisplayStatus(session: Session): 'running' | 'idle' {
    return session.thinking === true ? 'running' : 'idle';
}

export function aggregateActiveSessionsForNotification(sessions: Record<string, Session>): AggregatedSessionsResult {
    const activeSessions = Object.values(sessions)
        .filter(isSessionActiveAndOnline);

    if (activeSessions.length === 0) {
        return [];
    }

    // Sort: running sessions first, then idle sessions
    const sortedSessions = activeSessions.sort((a, b) => {
        const aStatus = getSessionDisplayStatus(a);
        const bStatus = getSessionDisplayStatus(b);
        if (aStatus === 'running' && bStatus === 'idle') return -1;
        if (aStatus === 'idle' && bStatus === 'running') return 1;
        return 0;
    });

    const maxDetailCount = 3;

    if (sortedSessions.length <= maxDetailCount) {
        return sortedSessions.map((session) => ({
            sessionId: session.id,
            title: resolveSessionTitle(session),
            status: getSessionDisplayStatus(session),
        }));
    }

    const detailSessions = sortedSessions.slice(0, maxDetailCount);
    const remainingCount = sortedSessions.length - maxDetailCount;

    return [
        ...detailSessions.map((session) => ({
            sessionId: session.id,
            title: resolveSessionTitle(session),
            status: getSessionDisplayStatus(session),
        })),
        { remainingCount },
    ];
}
