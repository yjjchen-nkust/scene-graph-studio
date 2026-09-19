import { useParams } from 'react-router';
import { UnknownLab } from './LabFrame';
import { MOUNTS } from './mounts';

/**
 * The eight labs, in the order PRD §6.2 numbers them.
 *
 * One list, derived from the mount table rather than written beside it, so a lab that is added
 * without a mount cannot appear here and a mount that is added without a lab cannot be missed.
 */
export const LAB_IDS = Object.keys(MOUNTS).sort() as (keyof typeof MOUNTS)[];

export function LabRoute() {
  const { labId = '' } = useParams();
  const Mount = MOUNTS[labId as keyof typeof MOUNTS];
  if (!Mount) return <UnknownLab labId={labId} />;
  return <Mount />;
}
