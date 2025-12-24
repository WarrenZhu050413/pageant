/**
 * Character Reference API
 *
 * CRUD operations for character references used in sequential/story generation.
 */

import type { CharacterReference, CharacterReferenceImage } from '../types';
import { makeListFetcher, request } from './fetchers';

// List all characters
export const fetchCharacters = makeListFetcher<CharacterReference>(
  '/characters',
  'characters'
);

// Get single character
export async function fetchCharacter(id: string): Promise<CharacterReference> {
  return request<CharacterReference>(`/characters/${id}`);
}

// Create character
export interface CreateCharacterRequest {
  name: string;
  description?: string;
  reference_images?: CharacterReferenceImage[];
}

export async function createCharacter(
  data: CreateCharacterRequest
): Promise<CharacterReference> {
  return request<CharacterReference>('/characters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update character
export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  reference_images?: CharacterReferenceImage[];
}

export async function updateCharacter(
  id: string,
  data: UpdateCharacterRequest
): Promise<CharacterReference> {
  return request<CharacterReference>(`/characters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete character
export async function deleteCharacter(id: string): Promise<void> {
  await request(`/characters/${id}`, { method: 'DELETE' });
}
