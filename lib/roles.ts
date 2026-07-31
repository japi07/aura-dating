/**
 * Who does what on Aura.
 *
 * The product is invitation-first: men send date proposals, women receive
 * them. Keeping that rule in one place means the sending UI can be hidden
 * consistently rather than each screen guessing.
 *
 * We're also not asking people who they're interested in for now — the launch
 * test is men→women and women→men, so it's derived from gender instead.
 */
import type { User } from '@/store/auth';

/** True when this user is allowed to send proposals. */
export function canSendProposals(user?: Pick<User, 'gender'> | null): boolean {
  return (user?.gender || '').toLowerCase() === 'male';
}

/**
 * Derive who someone is shown, from their own gender.
 * Non-binary members see everyone rather than being forced into a binary.
 */
export function derivedGenderInterest(gender?: string): 'male' | 'female' | 'everyone' {
  switch ((gender || '').toLowerCase()) {
    case 'male': return 'female';
    case 'female': return 'male';
    default: return 'everyone';
  }
}
