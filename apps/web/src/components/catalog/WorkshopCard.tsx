import { memo } from 'react';
import type { Workshop } from '../../types/workshop';
import { TicketCard, toTicketProps } from '../tickets';
import { useSessionClock } from '../../hooks/useSessionClock';

export const WorkshopCard = memo(function WorkshopCard({
  workshop,
  variant = 'default',
  priority = false,
}: {
  workshop: Workshop;
  priority?: boolean;
  variant?: 'default' | 'featured';
}) {
  const now = useSessionClock(workshop.sessions);
  return (
    <TicketCard
      {...toTicketProps(workshop, now)}
      variant={variant}
      priority={priority}
    />
  );
});
