import type { Workshop } from '../../types/workshop';
import { TicketCard, toTicketProps } from '../tickets';

export function WorkshopCard({ workshop, variant = 'default' }: { workshop: Workshop; variant?: 'default' | 'featured' }) {
  return <TicketCard {...toTicketProps(workshop)} variant={variant} />;
}
