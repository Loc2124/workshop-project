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
  all: ['management'] as const,
  myStudios: (userId: string | undefined) =>
    [...managementKeys.all, 'my-studios', userId] as const,
  studioWorkshops: (studioId: string) =>
    [...managementKeys.all, 'studio-workshops', studioId] as const,
  studioSessions: (studioId: string) =>
    [...managementKeys.all, 'studio-sessions', studioId] as const,
  adminStudios: (status?: StudioApprovalStatus) =>
    [...managementKeys.all, 'admin-studios', status ?? 'all'] as const,
  adminWorkshops: (filters: AdminWorkshopFilters) =>
    [...managementKeys.all, 'admin-workshops', filters] as const,
};

export function useMyStudios() {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: managementKeys.myStudios(user?.id),
    queryFn: ({ signal }) => managementService.listMyStudios(signal),
    enabled: !isLoading && Boolean(user),
  });
}

export function useCreateStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudioProfileInput) =>
      managementService.createStudio(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['management', 'admin-overview'],
      });
      await queryClient.invalidateQueries({
        queryKey: [...managementKeys.all, 'my-studios'],
      });
    },
  });
}

export function useStudioWorkshops(studioId: string) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: managementKeys.studioWorkshops(studioId),
    queryFn: ({ signal }) =>
      managementService.listStudioWorkshops(studioId, signal),
    enabled: !isLoading && Boolean(user && studioId),
  });
}

export function useSaveStudioWorkshop() {
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
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-overview'],
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(studioId),
        }),
        queryClient.invalidateQueries({
          queryKey: [...managementKeys.all, 'admin-workshops'],
        }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
    },
  });
}

export function useStudioSessions(studioId: string) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: managementKeys.studioSessions(studioId),
    queryFn: ({ signal }) =>
      managementService.listStudioSessions(studioId, signal),
    enabled: !isLoading && Boolean(user && studioId),
  });
}

export function useSaveStudioSession() {
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
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-overview'],
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioSessions(studioId),
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(studioId),
        }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
    },
  });
}

export function useCancelStudioSession() {
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
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-overview'],
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioSessions(studioId),
        }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
    },
  });
}

export function useAdminStudios(status?: StudioApprovalStatus, enabled = true) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: managementKeys.adminStudios(status),
    queryFn: ({ signal }) => managementService.listAdminStudios(status, signal),
    enabled: enabled && !isLoading && user?.role === 'admin',
  });
}
export function useAdminStudioDetail(studioId: string) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: ['management', 'admin-studio-detail', studioId],
    queryFn: ({ signal }) => managementService.getAdminStudio(studioId, signal),
    enabled: !isLoading && user?.role === 'admin' && Boolean(studioId),
  });
}

export function useAdminWorkshops(
  filters: AdminWorkshopFilters = {},
  enabled = true,
) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: managementKeys.adminWorkshops(filters),
    queryFn: ({ signal }) =>
      managementService.listAdminWorkshops(filters, signal),
    enabled: enabled && !isLoading && user?.role === 'admin',
  });
}

export function useSetStudioStatus() {
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
    onSuccess: async (_studio, { studioId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-studio-detail', studioId],
        }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-overview'],
        }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({
          queryKey: [...managementKeys.all, 'admin-studios'],
        }),
        queryClient.invalidateQueries({
          queryKey: [...managementKeys.all, 'my-studios'],
        }),
      ]);
    },
  });
}

export function useDecideWorkshop() {
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['management', 'admin-overview'],
        }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({
          queryKey: [...managementKeys.all, 'admin-workshops'],
        }),
        queryClient.invalidateQueries({
          queryKey: managementKeys.studioWorkshops(workshop.studioId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['catalog'],
        }),
      ]);
    },
  });
}

export function useSetStudioVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      studioId,
      decision,
    }: {
      studioId: string;
      decision: StudioVerificationDecision;
    }) => managementService.setStudioVerification(studioId, decision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: managementKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
    },
  });
}
