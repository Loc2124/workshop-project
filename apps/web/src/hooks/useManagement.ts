import { queryKeys } from '../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../lib/query-invalidation';
import type { StudioVerificationDecision } from '@workshop/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  managementService,
  type AdminWorkshopFilters,
} from '../services/managementService';
import type {
  StudioApprovalStatus,
  StudioProfileInput,
  StudioSessionInput,
  StudioSessionUpdateInput,
  StudioWorkshopInput,
  StudioWorkshopUpdateInput,
  WorkshopDecision,
} from '../types/management';

export const managementKeys = {
  myStudios: queryKeys.studios.mine,
  studioWorkshops: (studio: string, userId?: string) =>
    queryKeys.workshops.forStudio(userId, studio),
  studioSessions: (studio: string, userId?: string) =>
    queryKeys.bookings.slots(userId, studio),
  adminStudios: (status?: StudioApprovalStatus, userId?: string) =>
    queryKeys.studios.list(userId, { status: status ?? 'all' }),
  adminWorkshops: (filters: AdminWorkshopFilters, userId?: string) =>
    queryKeys.workshops.reviews.list(userId, filters),
};

export { useMyStudios } from './useOwnedStudios';

export function useCreateStudio() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudioProfileInput) =>
      managementService.createStudio(input),
    onSuccess: async () => {
      await invalidateResources(queryClient, userId, ['studios']);
    },
  });
}

export function useStudioWorkshops(studioId: string) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: managementKeys.studioWorkshops(studioId, userId),
    queryFn: ({ signal }) =>
      managementService.listStudioWorkshops(studioId, signal),
    enabled: !isLoading && Boolean(user && studioId),
  });
}

export function useSaveStudioWorkshop() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      workshopId,
      input,
    }: {
      studioId: string;
      workshopId: string | null;
      input: StudioWorkshopInput | StudioWorkshopUpdateInput;
    }) => managementService.saveStudioWorkshop(studioId, workshopId, input),
    onSuccess: async (_result, { studioId }) => {
      await Promise.all([
        invalidateResources(queryClient, userId, ['workshops']),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(studioId, userId),
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}

export function useStudioSessions(studioId: string) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: managementKeys.studioSessions(studioId, userId),
    queryFn: ({ signal }) =>
      managementService.listStudioSessions(studioId, signal),
    enabled: !isLoading && Boolean(user && studioId),
  });
}

export function useSaveStudioSession() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      workshopId,
      sessionId,
      input,
    }: {
      studioId: string;
      workshopId: string | null;
      sessionId: string | null;
      input: StudioSessionInput | StudioSessionUpdateInput;
    }) =>
      managementService.saveStudioSession(
        studioId,
        workshopId,
        sessionId,
        input,
      ),
    onSuccess: async (_result, { studioId }) => {
      await Promise.all([
        invalidateResources(queryClient, userId, ['workshops', 'bookings']),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioSessions(studioId, userId),
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(studioId, userId),
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}

export function useCancelStudioSession() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      sessionId,
    }: {
      studioId: string;
      sessionId: string;
    }) => managementService.cancelStudioSession(studioId, sessionId),
    onSuccess: async (_result, { studioId }) => {
      await Promise.all([
        invalidateResources(queryClient, userId, ['bookings']),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioSessions(studioId, userId),
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}

export function useAdminStudios(status?: StudioApprovalStatus, enabled = true) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: managementKeys.adminStudios(status, userId),
    queryFn: ({ signal }) => managementService.listAdminStudios(status, signal),
    enabled: enabled && !isLoading && user?.role === 'admin',
  });
}
export function useAdminStudioDetail(studioId: string) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: queryKeys.studios.detail(userId, studioId),
    queryFn: ({ signal }) => managementService.getAdminStudio(studioId, signal),
    enabled: !isLoading && user?.role === 'admin' && Boolean(studioId),
  });
}

export function useAdminWorkshops(
  filters: AdminWorkshopFilters = {},
  enabled = true,
) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: managementKeys.adminWorkshops(filters, userId),
    queryFn: ({ signal }) =>
      managementService.listAdminWorkshops(filters, signal),
    enabled: enabled && !isLoading && user?.role === 'admin',
  });
}

export function useSetStudioStatus() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      status,
      reason,
    }: {
      studioId: string;
      status: StudioApprovalStatus;
      reason?: string;
    }) => managementService.setStudioStatus(studioId, status, reason),
    onSuccess: async (studio, { studioId }) => {
      const key = queryKeys.studios.detail(userId, studioId);
      queryClient.setQueryData(key, (old: unknown) => ({
        ...((old ?? {}) as object),
        ...studio,
      }));
      await Promise.all([
        invalidateResources(queryClient, userId, [
          'studios',
          'workshops',
          'notifications',
        ]),
        queryClient.invalidateQueries({ queryKey: key, exact: true }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.public.categories,
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}

export function useDecideWorkshop() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workshopId,
      decision,
    }: {
      workshopId: string;
      decision: WorkshopDecision;
    }) => managementService.decideWorkshop(workshopId, decision),
    onSuccess: async (workshop) => {
      queryClient.setQueryData(
        queryKeys.workshops.reviews.detail(userId, workshop.id),
        workshop,
      );
      await Promise.all([
        invalidateResources(queryClient, userId, ['workshops']),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(workshop.studioId, userId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.public.categories,
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}

export function useSetStudioVerification() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      decision,
    }: {
      studioId: string;
      decision: StudioVerificationDecision;
    }) => managementService.setStudioVerification(studioId, decision),
    onSuccess: async (_result, { studioId }) => {
      await Promise.all([
        invalidateResources(queryClient, userId, ['studios', 'workshops']),
        queryClient.invalidateQueries({
          queryKey: queryKeys.studios.detail(userId, studioId),
          exact: true,
        }),
        invalidatePublicCatalog(queryClient),
      ]);
    },
  });
}
