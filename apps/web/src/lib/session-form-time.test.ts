import { describe, expect, it } from 'vitest';
import {
  fromVietnamDateTimeLocal,
  toVietnamDateTimeLocal,
} from './session-form-time';

describe('Vietnam session form time conversion', () => {
  it('displays API timestamps in UTC+7 regardless of the browser timezone', () => {
    expect(toVietnamDateTimeLocal('2026-12-01T02:00:00.000Z')).toBe(
      '2026-12-01T09:00',
    );
  });

  it('adds an explicit Vietnam offset to a local form value', () => {
    expect(fromVietnamDateTimeLocal('2026-12-01T09:00')).toBe(
      '2026-12-01T09:00:00+07:00',
    );
    expect(fromVietnamDateTimeLocal('bad')).toBe('');
  });
});
