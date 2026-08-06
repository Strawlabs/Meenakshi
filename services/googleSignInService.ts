/**
 * Platform router — Metro will prefer .android.ts / .ios.ts over this file.
 * This base file exists only as a fallback and re-exports the iOS stub types.
 * In practice it should never be bundled since Metro resolves platform-specific files first.
 */
export * from './googleSignInService.ios';
