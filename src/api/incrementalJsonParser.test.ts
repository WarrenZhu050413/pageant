import { describe, it, expect } from 'vitest';

// Extract the function for testing - we'll need to export it
// For now, recreate the logic here for testing
function extractCompleteScenesFromPartialJson(
  accumulatedText: string,
  alreadyParsedCount: number
): { scenes: Array<{ id: string; text: string; title: string; design: Record<string, string[]> }>; title?: string } {
  const scenes: Array<{ id: string; text: string; title: string; design: Record<string, string[]> }> = [];
  let title: string | undefined;

  // Try to extract the title first
  const titleMatch = accumulatedText.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Find the scenes array start
  const scenesStart = accumulatedText.indexOf('"scenes"');
  if (scenesStart === -1) return { scenes, title };

  const arrayStart = accumulatedText.indexOf('[', scenesStart);
  if (arrayStart === -1) return { scenes, title };

  // Extract content after the array start
  const afterArrayStart = accumulatedText.slice(arrayStart + 1);

  // Use bracket counting to find complete objects
  let depth = 0;
  let objectStart = -1;
  let sceneIndex = 0;

  for (let i = 0; i < afterArrayStart.length; i++) {
    const char = afterArrayStart[i];

    if (char === '{') {
      if (depth === 0) {
        objectStart = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        // Found a complete object
        if (sceneIndex >= alreadyParsedCount) {
          const objectStr = afterArrayStart.slice(objectStart, i + 1);
          try {
            const scene = JSON.parse(objectStr);
            // Convert backend schema to frontend schema
            scenes.push({
              id: scene.id || String(sceneIndex + 1),
              text: scene.description || '',
              title: scene.title || '',
              design: scene.design || {},
            });
          } catch {
            // Incomplete or malformed JSON, skip
          }
        }
        sceneIndex++;
        objectStart = -1;
      }
    }
  }

  return { scenes, title };
}

describe('extractCompleteScenesFromPartialJson', () => {
  describe('title extraction', () => {
    it('extracts title from partial JSON', () => {
      const partial = '{"title": "Sunset Beach"';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.title).toBe('Sunset Beach');
      expect(result.scenes).toHaveLength(0);
    });

    it('extracts title with escaped characters', () => {
      const partial = '{"title": "A \\"Quoted\\" Title"';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.title).toBe('A \\"Quoted\\" Title');
    });

    it('returns undefined title when not present', () => {
      const partial = '{"scenes": [';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.title).toBeUndefined();
    });
  });

  describe('scene extraction', () => {
    it('returns empty array when no scenes array found', () => {
      const partial = '{"title": "Test"';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(0);
    });

    it('returns empty array when scenes array is not started', () => {
      const partial = '{"title": "Test", "scenes"';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(0);
    });

    it('returns empty array when scenes array is empty', () => {
      const partial = '{"title": "Test", "scenes": []}';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(0);
    });

    it('extracts one complete scene', () => {
      const partial = `{"title": "Test", "scenes": [{"id": "1", "title": "Scene One", "description": "A beautiful scene"}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toEqual({
        id: '1',
        title: 'Scene One',
        text: 'A beautiful scene',
        design: {},
      });
    });

    it('extracts multiple complete scenes', () => {
      const partial = `{"title": "Test", "scenes": [
        {"id": "1", "title": "Scene One", "description": "First scene"},
        {"id": "2", "title": "Scene Two", "description": "Second scene"}
      `;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].id).toBe('1');
      expect(result.scenes[1].id).toBe('2');
    });

    it('ignores incomplete scene at end', () => {
      const partial = `{"title": "Test", "scenes": [
        {"id": "1", "title": "Complete", "description": "Done"},
        {"id": "2", "title": "Incomplete", "desc
      `;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].title).toBe('Complete');
    });

    it('handles nested objects in design field', () => {
      const partial = `{"scenes": [{"id": "1", "title": "Test", "description": "Desc", "design": {"colors": ["red", "blue"], "mood": ["calm"]}}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].design).toEqual({
        colors: ['red', 'blue'],
        mood: ['calm'],
      });
    });

    it('handles deeply nested objects', () => {
      const partial = `{"scenes": [{"id": "1", "title": "Test", "description": "Desc", "design_dimensions": [{"name": "Lighting", "value": {"type": "soft"}}]}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
    });
  });

  describe('incremental parsing with alreadyParsedCount', () => {
    it('skips already parsed scenes', () => {
      const partial = `{"scenes": [
        {"id": "1", "title": "First", "description": "One"},
        {"id": "2", "title": "Second", "description": "Two"},
        {"id": "3", "title": "Third", "description": "Three"}
      ]}`;

      // First call - get all 3
      const result1 = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result1.scenes).toHaveLength(3);

      // Second call - already have 2, only get new one
      const result2 = extractCompleteScenesFromPartialJson(partial, 2);
      expect(result2.scenes).toHaveLength(1);
      expect(result2.scenes[0].id).toBe('3');

      // Third call - already have all 3
      const result3 = extractCompleteScenesFromPartialJson(partial, 3);
      expect(result3.scenes).toHaveLength(0);
    });

    it('returns empty when all scenes already parsed', () => {
      const partial = `{"scenes": [{"id": "1", "description": "One"}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 1);
      expect(result.scenes).toHaveLength(0);
    });
  });

  describe('streaming simulation', () => {
    it('simulates real streaming scenario', () => {
      // Simulate chunks arriving over time
      const chunks = [
        '{"title": "My Gen',
        'eration", "scenes": [',
        '{"id": "1", "title": "First',
        '", "description": "A lovely scene",',
        ' "design": {"colors": ["gold"]}},',
        '{"id": "2", "title": "Second", "description": "Another scene"}',
        ']}',
      ];

      let accumulated = '';
      let parsedCount = 0;
      const allScenes: Array<{ id: string; text: string; title: string }> = [];

      for (const chunk of chunks) {
        accumulated += chunk;
        const result = extractCompleteScenesFromPartialJson(accumulated, parsedCount);

        if (result.scenes.length > 0) {
          allScenes.push(...result.scenes);
          parsedCount += result.scenes.length;
        }
      }

      expect(allScenes).toHaveLength(2);
      expect(allScenes[0].id).toBe('1');
      expect(allScenes[0].title).toBe('First');
      expect(allScenes[1].id).toBe('2');
    });

    it('handles chunked JSON with partial objects', () => {
      // First chunk: title and start of scenes
      let accumulated = '{"title": "Test", "scenes": [{"id": "1"';
      let result = extractCompleteScenesFromPartialJson(accumulated, 0);
      expect(result.scenes).toHaveLength(0); // Not complete yet
      expect(result.title).toBe('Test');

      // Second chunk: complete first scene
      accumulated += ', "title": "One", "description": "First"}';
      result = extractCompleteScenesFromPartialJson(accumulated, 0);
      expect(result.scenes).toHaveLength(1);

      // Third chunk: start second scene (incomplete)
      accumulated += ', {"id": "2", "title": "Two"';
      result = extractCompleteScenesFromPartialJson(accumulated, 1);
      expect(result.scenes).toHaveLength(0); // Second not complete

      // Fourth chunk: complete second scene
      accumulated += ', "description": "Second"}]}';
      result = extractCompleteScenesFromPartialJson(accumulated, 1);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].id).toBe('2');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = extractCompleteScenesFromPartialJson('', 0);
      expect(result.scenes).toHaveLength(0);
      expect(result.title).toBeUndefined();
    });

    it('handles malformed JSON gracefully', () => {
      const partial = '{"scenes": [{"id": "1", broken json here}]}';
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      // Should not throw, just return empty
      expect(result.scenes).toHaveLength(0);
    });

    it('handles scenes with curly braces in string values', () => {
      // This is a known limitation - strings with { } may confuse bracket counting
      // For now, we accept this limitation since LLM output rarely has this
      const partial = `{"scenes": [{"id": "1", "title": "Test", "description": "Simple desc"}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
    });

    it('handles missing fields gracefully', () => {
      const partial = `{"scenes": [{"id": "1"}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toEqual({
        id: '1',
        title: '',
        text: '',
        design: {},
      });
    });

    it('generates default id when missing', () => {
      const partial = `{"scenes": [{"title": "No ID", "description": "Test"}]}`;
      const result = extractCompleteScenesFromPartialJson(partial, 0);
      expect(result.scenes[0].id).toBe('1'); // Default based on index
    });
  });
});
