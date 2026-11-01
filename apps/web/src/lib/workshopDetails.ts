import type { Workshop, WorkshopSession } from '../types/workshop';

export function upcomingSessions(sessions: WorkshopSession[], now = Date.now()) {
  return sessions.filter((session) => Number.isFinite(Date.parse(session.startsAt)) && Date.parse(session.startsAt) >= now)
    .slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function workshopLevel(value: string) {
  return ({ beginner: 'Người mới bắt đầu', intermediate: 'Đã có trải nghiệm', all: 'Mọi trình độ' } as Record<string, string>)[value] ?? value;
}

export function sessionCalendar(workshop: Workshop, session: WorkshopSession, now = new Date()) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const fold = (line: string) => {
    const encoder = new TextEncoder();
    let size = 0;
    let output = '';
    for (const character of line) {
      const bytes = encoder.encode(character).length;
      if (size + bytes > 74) { output += '\r\n '; size = 1; }
      output += character; size += bytes;
    }
    return output;
  };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Open Slot//Workshop//VI', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${escape(session.id)}@open-slot`, `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(session.startsAt))}`, `DTEND:${stamp(new Date(session.endsAt))}`,
    `SUMMARY:${escape(workshop.title)}`, `LOCATION:${escape([workshop.studioName, workshop.address, workshop.province].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escape(workshop.description)}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
