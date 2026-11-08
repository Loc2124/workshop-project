import { describe, expect, it } from 'vitest';
import {
  studioDashboardStats,
  studioState,
  switchStudioPath,
} from './studio-dashboard';
import type { StudioSession, StudioWorkshop } from '../types/management';

describe('studio dashboard', () => {
  it('preserves the section when switching studios', () => {
    expect(switchStudioPath('/studio/first/workshops', 'second')).toBe(
      '/studio/second/workshops',
    );
    expect(switchStudioPath('/studio/first', 'second')).toBe('/studio/second');
    expect(switchStudioPath('/studio/first/profile', 'second')).toBe(
      '/studio/second/profile',
    );
  });
  it('counts future scheduled sessions for operations and subtracts held and sold seats', () => {
    const workshops = [
      { id: 'a', status: 'approved' },
      { id: 'b', status: 'pending' },
    ] as StudioWorkshop[];
    const base = {
      workshopId: 'a',
      startsAt: '2030-01-01T00:00:00Z',
      status: 'scheduled',
      capacity: 10,
      seatsHeld: 2,
      seatsSold: 3,
    };
    const sessions = [
      base,
      { ...base, status: 'cancelled' },
      { ...base, startsAt: '2020-01-01T00:00:00Z' },
      { ...base, workshopId: 'b', capacity: 4, seatsHeld: 1, seatsSold: 3 },
    ] as StudioSession[];
    expect(
      studioDashboardStats(workshops, sessions, Date.parse('2029-01-01')),
    ).toEqual({ upcomingSessions: 2, openWorkshops: 1, availableSeats: 5 });
  });
  it('distinguishes drafts from submitted pending profiles', () => {
    expect(studioState({ status: 'pending', isDraft: true })).toBe('draft');
    expect(studioState({ status: 'pending' })).toBe('pending');
  });
});
