import { useEffect } from 'react';
import { loadProgress, saveProgress } from './persist';

/**
 * How far a reader has got in a module: the highest step index reached, plus one.
 *
 * Monotonic. Opening a module at step zero after finishing it must not erase the finish, so the
 * record only ever moves forward; "where I am" is in the URL, and this is "how far I have been".
 *
 * Written from both shells, because both are ways of moving through the same steps and a reader
 * who watched the lecture has read the module.
 */
export function recordProgress(moduleId: string, stepsSeen: number): void {
  if (!moduleId || stepsSeen <= 0) return;
  const progress = loadProgress();
  const already = progress.modules[moduleId] ?? 0;
  if (stepsSeen <= already) return;
  saveProgress({ ...progress, modules: { ...progress.modules, [moduleId]: stepsSeen } });
}

/** The same, as an effect. Runs after paint, so no shell waits on storage to render. */
export function useRecordProgress(moduleId: string, stepsSeen: number): void {
  useEffect(() => {
    recordProgress(moduleId, stepsSeen);
  }, [moduleId, stepsSeen]);
}

export interface Resume {
  moduleId: string;
  stepsSeen: number;
}

/**
 * The module to offer as "resume", or none.
 *
 * The furthest module touched, by the order the caller gives — which is curriculum order, not
 * the order of the stored keys. A reader who dipped into M12 and then worked through M03 is
 * offered M12, because that is where they got to.
 */
export function resumePoint(orderedModuleIds: string[]): Resume | null {
  const { modules } = loadProgress();
  let found: Resume | null = null;
  for (const moduleId of orderedModuleIds) {
    const stepsSeen = modules[moduleId];
    if (stepsSeen && stepsSeen > 0) found = { moduleId, stepsSeen };
  }
  return found;
}
