/**
 * Types and validation schemas shared by the API and the SPA.
 *
 * This package exists so the two halves cannot drift: the request schemas the API
 * validates against are the same objects the SPA builds its forms from.
 */
export * from './pagination'
