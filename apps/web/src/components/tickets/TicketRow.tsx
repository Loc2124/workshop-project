import { TicketCard } from './TicketCard';
import type { TicketVariantProps } from './types';

export function TicketRow(
  props: TicketVariantProps & { featured?: boolean; ticketNumber?: number },
) {
  return (
    <TicketCard {...props} variant={props.featured ? 'featured' : 'default'} />
  );
}
