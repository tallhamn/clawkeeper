/**
 * Guards against stale poll results overwriting fresh mutation state.
 *
 * After a mutation, poll results are suppressed for `cooldownMs` to prevent
 * in-flight polls from reverting optimistic/confirmed state updates.
 */
export function createPollGuard(cooldownMs: number) {
  let lastMutationTime = 0;

  return {
    /** Call when a mutation (API write) starts. */
    markMutation() {
      lastMutationTime = Date.now();
    },

    /** Returns true if enough time has passed since the last mutation. */
    shouldPoll(): boolean {
      return Date.now() - lastMutationTime >= cooldownMs;
    },

    /** Exposed for testing. */
    _getLastMutationTime() {
      return lastMutationTime;
    },
  };
}
