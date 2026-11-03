import { memo } from 'react';
import type { Workshop } from '../../types/workshop';
import { TicketCard, toTicketProps } from '../tickets';

export const WorkshopCard = memo(function WorkshopCard({
  workshop,
  variant = 'default',
  priority = false,
}: {
  workshop: Workshop;
  priority?: boolean;
  variant?: 'default' | 'featured';
}) {
  return (
    <TicketCard
      {...toTicketProps(workshop)}
      variant={variant}
      priority={priority}
    />
  );
});
