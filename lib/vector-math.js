/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
}

/**
 * Calculates the average of multiple vectors.
 * @param {number[][]} vectors 
 * @returns {number[]}
 */
export function averageVectors(vectors) {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const avg = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      avg[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    avg[i] /= vectors.length;
  }
  return avg;
}

/**
 * Calculates the weighted average of multiple vectors.
 * @param {number[][]} vectors 
 * @param {number[]} weights 
 * @returns {number[]}
 */
export function weightedAverageVectors(vectors, weights) {
  if (vectors.length === 0) return [];
  if (vectors.length !== weights.length) return averageVectors(vectors);
  
  const dim = vectors[0].length;
  const avg = new Array(dim).fill(0);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const w = weights[i];
    for (let j = 0; j < dim; j++) {
      avg[j] += v[j] * w;
    }
  }

  for (let i = 0; i < dim; i++) {
    avg[i] /= weightSum;
  }
  return avg;
}
