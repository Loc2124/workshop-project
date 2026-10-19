import { AppError } from '../../errors/app-error.js';
import { findOrganizerByUserId, setUserRole, upsertOrganizerProfile } from './organizers.repository.js';
import type { OrganizerProfileInput } from './organizers.schemas.js';

export async function createOrganizerProfile(userId: string, input: OrganizerProfileInput): Promise<{
  organizer: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    address: string | null;
    district: string | null;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
  };
  created: boolean;
}> {
  const existing = await findOrganizerByUserId(userId);
  const organizer = await upsertOrganizerProfile(userId, input);
  await setUserRole(userId, 'organizer');

  return {
    organizer: {
      id: organizer.id,
      userId: organizer.userId,
      name: organizer.name,
      description: organizer.description,
      address: organizer.address,
      district: organizer.district,
      status: organizer.status,
      createdAt: organizer.createdAt,
    },
    created: !existing,
  };
}
