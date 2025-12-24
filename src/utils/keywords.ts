import { removeStopwords, eng } from 'stopword';

/**
 * Additional image-generation-specific stop words to filter
 */
const IMAGE_GENERATION_STOPWORDS = [
  'image', 'picture', 'photo', 'photograph', 'scene', 'showing', 'depicts',
  'style', 'styled', 'like', 'similar', 'create', 'generate', 'make',
];

/**
 * Extract meaningful keywords from a text, filtering out stop words
 * Uses the stopword package for comprehensive English stop word removal
 * @param text - The text to extract keywords from
 * @returns Array of unique keywords (lowercase)
 */
export function extractKeywords(text: string): string[] {
  // Split on whitespace and punctuation, convert to lowercase
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces (keep hyphens)
    .split(/\s+/)
    .filter(word => word.length > 2) // Filter out very short words
    .filter(word => !/^\d+$/.test(word)); // Filter out pure numbers

  // Remove English stop words using the stopword package
  const withoutStopwords = removeStopwords(words, eng);

  // Also remove image-generation-specific common words
  const filtered = withoutStopwords.filter(
    word => !IMAGE_GENERATION_STOPWORDS.includes(word)
  );

  // Return unique words
  return [...new Set(filtered)];
}

/**
 * Sample random keywords from an array of prompts
 * @param prompts - Array of prompt strings
 * @param count - Number of keywords to sample (default 10)
 * @returns Array of randomly sampled keywords
 */
export function sampleKeywordsFromPrompts(prompts: string[], count: number = 10): string[] {
  // Extract all keywords from all prompts
  const allKeywords = prompts.flatMap(p => extractKeywords(p));

  // Count frequency of each keyword
  const frequency = new Map<string, number>();
  for (const word of allKeywords) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  // Get unique keywords sorted by frequency (most common first)
  const uniqueKeywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  if (uniqueKeywords.length <= count) {
    return uniqueKeywords;
  }

  // Sample with bias towards more frequent words
  // Take top 30% by frequency, then random sample from the rest
  const topCount = Math.ceil(uniqueKeywords.length * 0.3);
  const topKeywords = uniqueKeywords.slice(0, topCount);
  const restKeywords = uniqueKeywords.slice(topCount);

  // Shuffle the rest
  const shuffledRest = [...restKeywords].sort(() => Math.random() - 0.5);

  // Combine: take some from top, some from shuffled rest
  const fromTop = Math.min(Math.ceil(count * 0.5), topKeywords.length);
  const fromRest = count - fromTop;

  const result = [
    ...topKeywords.slice(0, fromTop),
    ...shuffledRest.slice(0, fromRest),
  ];

  // Shuffle final result so top words aren't always first
  return result.sort(() => Math.random() - 0.5);
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sample random items from an array
 * @param array - Array to sample from
 * @param count - Number of items to sample
 * @returns Array of randomly sampled items
 */
export function sampleArray<T>(array: T[], count: number): T[] {
  if (array.length <= count) {
    return [...array];
  }
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
