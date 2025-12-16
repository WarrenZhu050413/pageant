/**
 * Store slices for Zustand state management.
 *
 * These slices can be composed together using Zustand's slice pattern:
 * https://zustand.docs.pmnd.rs/guides/typescript#slices-pattern
 *
 * Example usage:
 * ```ts
 * import { create } from 'zustand'
 * import { createNavigationSlice, NavigationSlice } from './slices'
 * import { createSelectionSlice, SelectionSlice } from './slices'
 *
 * type AppStore = NavigationSlice & SelectionSlice
 *
 * export const useStore = create<AppStore>()((...args) => ({
 *   ...createNavigationSlice(...args),
 *   ...createSelectionSlice(...args),
 * }))
 * ```
 */

export { createNavigationSlice, type NavigationSlice } from './navigationSlice'
export { createSelectionSlice, type SelectionSlice } from './selectionSlice'
export { createGenerationSlice, type GenerationSlice } from './generationSlice'
export { createLibrarySlice, type LibrarySlice } from './librarySlice'
export { createSessionSlice, type SessionSlice } from './sessionSlice'
