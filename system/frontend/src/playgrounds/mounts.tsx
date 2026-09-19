import type { ComponentType } from 'react';
import { LabelsToStructure } from './F1/LabelsToStructure';

/**
 * Every playground, keyed by the knowledge point it demonstrates.
 *
 * One table, and `PLAYGROUND_IDS` derived from it rather than written beside it, so a component
 * without an entry cannot appear and an entry without a component cannot be missed.
 * `labs/mounts.tsx` is keyed by lab id for the same reason.
 *
 * Entries are added by the task that builds each playground.
 */
export const PLAYGROUND_MOUNTS: Record<string, ComponentType> = {
  F1: LabelsToStructure,
};

export const PLAYGROUND_IDS: string[] = Object.keys(PLAYGROUND_MOUNTS).sort();
