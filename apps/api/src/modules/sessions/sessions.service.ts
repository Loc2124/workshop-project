import { AppError } from '../../errors/app-error.js';
import {
  cancelSession as cancelOwnedSession,
  createSession as insertSession,
  listStudioSessions as selectStudioSessions,
  updateSession as saveSession,
} from './sessions.repository.js';
import type { SessionInput, SessionUpdate } from './sessions.schemas.js';
import { getStudioMemberRole } from '../studios/studios.repository.js';

export async function getStudioSessions(studioId: string, userId: string) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  return {
    sessions: (await selectStudioSessions(studioId, userId)) ?? [],
  };
}

export async function createStudioSession(
  studioId: string,
  userId: string,
  workshopId: string,
  input: SessionInput,
) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  if (Object.hasOwn(input, 'price') && role !== 'owner') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được đặt giá buổi workshop.',
    );
  }

  const session = await insertSession(studioId, userId, workshopId, input);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }
  return { session };
}

export async function updateStudioSession(
  studioId: string,
  userId: string,
  sessionId: string,
  input: SessionUpdate,
) {
  const result = await saveSession(studioId, userId, sessionId, input);
  if (!result) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy buổi workshop.');
  }
  if (result.conflict === 'capacity') {
    throw new AppError(
      409,
      'CONFLICT',
      'Sức chứa phải lớn hơn số chỗ đã giữ hoặc đã bán và thời gian kết thúc phải sau thời gian bắt đầu.',
    );
  }
  if (result.conflict === 'price_locked') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể đổi giá buổi đã có đăng ký đang chờ thanh toán, đã thanh toán hoặc cần hoàn tiền.',
    );
  }
  if (result.conflict === 'schedule_locked') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể đổi lịch buổi đã có đăng ký đang chờ thanh toán, đã thanh toán hoặc cần hoàn tiền.',
    );
  }
  if (result.conflict === 'session_closed') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể sửa buổi đã hủy, đã hoàn thành hoặc đã bắt đầu.',
    );
  }
  if (result.conflict === 'owner_required') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được thay đổi giá buổi workshop.',
    );
  }
  if (result.conflict === 'invalid_schedule') {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Thời gian kết thúc phải sau thời gian bắt đầu.',
    );
  }
  return { session: result.session };
}

export async function cancelStudioSession(
  studioId: string,
  userId: string,
  sessionId: string,
) {
  const session = await cancelOwnedSession(studioId, userId, sessionId);
  if (!session) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy buổi workshop có thể hủy.',
    );
  }
  return { session };
}
