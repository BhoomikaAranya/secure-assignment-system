// src/services/plagiarismService.js

/**
 * Normalize text before comparison.
 */
export function normalizeText(text) {
  if (!text) {
    return "";
  }

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert text into a set of unique words.
 */
function getWordSet(text) {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((word) => word.length > 0)
  );
}

/**
 * Calculate Jaccard similarity.
 *
 * Returns a percentage between 0 and 100.
 */
export function calculateSimilarity(text1, text2) {
  const words1 = getWordSet(text1);
  const words2 = getWordSet(text2);

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set(
    [...words1].filter((word) => words2.has(word))
  );

  const union = new Set([...words1, ...words2]);

  const similarity =
    (intersection.size / union.size) * 100;

  return Number(similarity.toFixed(2));
}

/**
 * Find the previous submission with the highest
 * similarity to the new submission.
 */
export function findMostSimilarSubmission(
  newText,
  previousSubmissions
) {
  let highestSimilarity = 0;
  let mostSimilarSubmission = null;

  for (const submission of previousSubmissions) {
    if (!submission.text) {
      continue;
    }

    const similarity = calculateSimilarity(
      newText,
      submission.text
    );

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;

      mostSimilarSubmission = submission;
    }
  }

  return {
    similarity: highestSimilarity,
    matchedSubmission: mostSimilarSubmission,
  };
}

/**
 * Convert similarity percentage into a simple
 * project status.
 *
 * This is only an indicator and does not prove
 * academic misconduct.
 */
export function getSimilarityStatus(similarity) {
  if (similarity >= 70) {
    return "High Similarity";
  }

  if (similarity >= 40) {
    return "Moderate Similarity";
  }

  return "Low Similarity";
}