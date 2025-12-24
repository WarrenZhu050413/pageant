import type { StateCreator } from 'zustand';
import type { CharacterReference } from '../../types';

export interface CharactersSlice {
  // State
  characters: CharacterReference[];
  currentCharacterId: string | null;

  // Actions (state-only, no API calls - those remain in main store)
  setCharacters: (characters: CharacterReference[]) => void;
  setCurrentCharacter: (id: string | null) => void;
}

export const createCharactersSlice: StateCreator<CharactersSlice> = (set) => ({
  // Initial state
  characters: [],
  currentCharacterId: null,

  // Actions
  setCharacters: (characters) => set({ characters }),
  setCurrentCharacter: (id) => set({ currentCharacterId: id }),
});
