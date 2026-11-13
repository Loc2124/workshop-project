import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  emptyStudioDraft,
  readStudioDraft,
  studioDraftKey,
  studioDraftReturnKey,
  type StudioDraftValues,
} from '../lib/studio-registration-draft';

export function useStudioRegistrationDraft(
  userId: string | undefined,
  authLoading: boolean,
) {
  const [search] = useSearchParams();
  const candidate = search.get('draftStudioId');
  const requestedDraftId =
    candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      candidate,
    )
      ? candidate
      : null;
  const key = studioDraftKey(userId);
  const restoredKey = useRef('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [draft, setDraft] = useState({
    key: '',
    values: { ...emptyStudioDraft },
    step: 0 as 0 | 1,
  });
  useEffect(() => {
    const restoreId = `${key}:${requestedDraftId ?? ''}`;
    if (authLoading || restoredKey.current === restoreId) return;
    restoredKey.current = restoreId;
    let restored = { values: { ...emptyStudioDraft }, step: 0 as 0 | 1 };
    try {
      restored = readStudioDraft(sessionStorage, key);
      if (userId && sessionStorage.getItem(studioDraftReturnKey) === 'true') {
        const guest = sessionStorage.getItem(studioDraftKey());
        if (guest) {
          restored = readStudioDraft(sessionStorage, studioDraftKey());
          sessionStorage.setItem(key, JSON.stringify(restored));
        }
        sessionStorage.removeItem(studioDraftKey());
        sessionStorage.removeItem(studioDraftReturnKey);
      }
    } catch {
      setStorageAvailable(false);
      /* The form still works when browser storage is disabled. */
    }
    if (
      requestedDraftId &&
      restored.values.draftStudioId !== requestedDraftId
    ) {
      restored = {
        values: { ...emptyStudioDraft, draftStudioId: requestedDraftId },
        step: 0,
      };
    }
    setDraft({ key, ...restored });
  }, [key, userId, authLoading, requestedDraftId]);
  useEffect(() => {
    if (authLoading || draft.key !== key) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ values: draft.values, step: draft.step }),
      );
    } catch {
      setStorageAvailable(false);
      /* Saving a draft is optional. */
    }
  }, [draft, key, authLoading]);
  function update<K extends keyof StudioDraftValues>(
    field: K,
    value: StudioDraftValues[K],
  ) {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [field]: value },
    }));
  }
  function setStep(step: 0 | 1) {
    setDraft((current) => ({ ...current, step }));
  }
  function prepareAuth() {
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ values: draft.values, step: draft.step }),
      );
      sessionStorage.setItem(studioDraftReturnKey, 'true');
    } catch {
      /* Continue to authentication even without storage. */
    }
  }
  function clear() {
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(studioDraftReturnKey);
    } catch {
      /* Nothing else to clear. */
    }
    setDraft({ key, values: { ...emptyStudioDraft }, step: 0 });
  }
  const hasContent = Boolean(
    draft.values.draftStudioId ||
    draft.step === 1 ||
    draft.values.name.trim() ||
    draft.values.categoryIds.length > 0 ||
    draft.values.provinceId ||
    draft.values.address.trim() ||
    draft.values.contactPhone.trim() ||
    draft.values.contactEmail.trim() ||
    draft.values.photoIds.length > 0 ||
    draft.values.description.trim() ||
    draft.values.facebookUrl.trim() ||
    draft.values.instagramUrl.trim() ||
    draft.values.googleMapsUrl.trim() ||
    draft.values.proposedCategoryName.trim(),
  );
  return {
    values: draft.values,
    step: draft.step,
    ready: !authLoading && draft.key === key,
    hasContent,
    storageAvailable,
    update,
    setStep,
    prepareAuth,
    clear,
  };
}
