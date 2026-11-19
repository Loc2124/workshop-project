export {
  createSessionContractSchema as createSessionSchema,
  updateSessionContractSchema as updateSessionSchema,
  type CreateSessionContractInput as SessionInput,
  type UpdateSessionContractInput as SessionUpdateInput,
} from '@workshop/shared';

export type SessionUpdate = {
  startsAt?: string;
  endsAt?: string;
  price?: number;
  capacity?: number;
  registrationDeadline?: string | null;
};
