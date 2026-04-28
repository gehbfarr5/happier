import { describe, expect, it } from 'vitest';
import type { Session } from '@/sync/domains/state/storageTypes';

import { aggregateActiveSessionsForNotification, type AggregatedSessionSummary } from './sessionAggregation';

describe('sessionAggregation', () => {
    describe('aggregateActiveSessionsForNotification', () => {
        function createMockSession(overrides: Partial<Session> & { id: string }): Session {
            return {
                seq: 0,
                createdAt: 0,
                updatedAt: 0,
                active: true,
                activeAt: 0,
                metadata: null,
                metadataVersion: 0,
                agentState: null,
                agentStateVersion: 0,
                thinking: false,
                thinkingAt: 0,
                presence: 'online',
                ...overrides,
            };
        }

        it('returns empty array when no active sessions exist', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({ id: 'session-1', active: false, presence: 1000 }),
                'session-2': createMockSession({ id: 'session-2', active: false, presence: 2000 }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toEqual([]);
        });

        it('returns empty array when sessions record is empty', () => {
            const result = aggregateActiveSessionsForNotification({});

            expect(result).toEqual([]);
        });

        it('returns single session with correct status for running session', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: {
                        summary: { text: 'Building project', updatedAt: Date.now() },
                    } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                sessionId: 'session-1',
                title: 'Building project',
                status: 'running',
            });
        });

        it('returns single session with idle status for non-thinking active session', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: {
                        summary: { text: 'Waiting for input', updatedAt: Date.now() },
                    } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                sessionId: 'session-1',
                title: 'Waiting for input',
                status: 'idle',
            });
        });

        it('uses session id as fallback title when metadata summary is missing', () => {
            const sessions: Record<string, Session> = {
                'session-abc': createMockSession({
                    id: 'session-abc',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: null,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                sessionId: 'session-abc',
                title: 'session-abc',
                status: 'idle',
            });
        });

        it('returns up to 3 sessions in detail, sorted by running status first', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 1', updatedAt: 1 } } as any,
                }),
                'session-2': createMockSession({
                    id: 'session-2',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 2', updatedAt: 2 } } as any,
                }),
                'session-3': createMockSession({
                    id: 'session-3',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 3', updatedAt: 3 } } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(3);
            // Running sessions sorted first: session-1, session-3
            expect(result[0]).toMatchObject({ sessionId: 'session-1', status: 'running' });
            expect(result[1]).toMatchObject({ sessionId: 'session-3', status: 'running' });
            // Idle session last: session-2
            expect(result[2]).toMatchObject({ sessionId: 'session-2', status: 'idle' });
        });

        it('returns first 3 sessions plus remaining count when more than 3 active sessions', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 1', updatedAt: 1 } } as any,
                }),
                'session-2': createMockSession({
                    id: 'session-2',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 2', updatedAt: 2 } } as any,
                }),
                'session-3': createMockSession({
                    id: 'session-3',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 3', updatedAt: 3 } } as any,
                }),
                'session-4': createMockSession({
                    id: 'session-4',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 4', updatedAt: 4 } } as any,
                }),
                'session-5': createMockSession({
                    id: 'session-5',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Task 5', updatedAt: 5 } } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(4);
            // First 3 details should prioritize running sessions
            expect(result[0]).toMatchObject({ sessionId: 'session-1', status: 'running' });
            expect(result[1]).toMatchObject({ sessionId: 'session-3', status: 'running' });
            expect(result[2]).toMatchObject({ sessionId: 'session-5', status: 'running' });
            expect(result[3]).toMatchObject({ remainingCount: 2 });
        });

        it('excludes inactive sessions from aggregation', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Active Task', updatedAt: 1 } } as any,
                }),
                'session-2': createMockSession({
                    id: 'session-2',
                    active: false,
                    presence: 1000,
                    metadata: { summary: { text: 'Inactive Task', updatedAt: 2 } } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ sessionId: 'session-1', status: 'running' });
        });

        it('excludes offline sessions from aggregation', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Online Task', updatedAt: 1 } } as any,
                }),
                'session-2': createMockSession({
                    id: 'session-2',
                    active: true,
                    thinking: false,
                    presence: 5000,
                    metadata: { summary: { text: 'Offline Task', updatedAt: 2 } } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ sessionId: 'session-1', status: 'running' });
        });

        it('sorts running sessions before idle sessions', () => {
            const sessions: Record<string, Session> = {
                'session-1': createMockSession({
                    id: 'session-1',
                    active: true,
                    thinking: false,
                    presence: 'online',
                    metadata: { summary: { text: 'Idle Task', updatedAt: 1 } } as any,
                }),
                'session-2': createMockSession({
                    id: 'session-2',
                    active: true,
                    thinking: true,
                    presence: 'online',
                    metadata: { summary: { text: 'Running Task', updatedAt: 2 } } as any,
                }),
            };

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ sessionId: 'session-2', status: 'running' });
            expect(result[1]).toMatchObject({ sessionId: 'session-1', status: 'idle' });
        });

        it('handles 6 active sessions with correct remaining count', () => {
            const sessions: Record<string, Session> = {};
            for (let i = 1; i <= 6; i++) {
                sessions[`session-${i}`] = createMockSession({
                    id: `session-${i}`,
                    active: true,
                    thinking: i % 2 === 0,
                    presence: 'online',
                    metadata: { summary: { text: `Task ${i}`, updatedAt: i } } as any,
                });
            }

            const result = aggregateActiveSessionsForNotification(sessions);

            expect(result).toHaveLength(4);
            expect(result[3]).toMatchObject({ remainingCount: 3 });
        });
    });
});
