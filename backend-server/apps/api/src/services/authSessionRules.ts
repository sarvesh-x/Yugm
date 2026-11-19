export function hasFirebaseIdentityConflict(existingFirebaseUid: string | undefined | null, incomingFirebaseUid: string): boolean {
  return Boolean(existingFirebaseUid && existingFirebaseUid !== incomingFirebaseUid);
}

export function isSessionGenerationCurrent(sessionTokenVersion: number | undefined, userTokenVersion: number): boolean {
  // Sessions issued before token generations existed remain valid until the next login.
  return (sessionTokenVersion ?? userTokenVersion) === userTokenVersion;
}
