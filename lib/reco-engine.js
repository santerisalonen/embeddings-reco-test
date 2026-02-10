import { getEmbeddings, getManifest } from "./data.js";
import { cosineSimilarity, weightedAverageVectors } from "./vector-math.js";

/**
 * Gets recommendations based on user history using a sliding window of 3.
 * @param {Object[]} userEvents 
 * @param {Object} options
 * @param {boolean} options.recommendationOnly
 * @param {string} options.category
 * @returns {Promise<Object[]>} Sorted list of products with similarity scores
 */
export async function getRecommendations(userEvents, options = {}) {
  const embeddings = await getEmbeddings();
  let manifest = await getManifest();

  const category = options.category || 'apparel';
  manifest = manifest.filter(p => p.category === category);

  if (options.recommendationOnly) {
    manifest = manifest.filter(p => p.recommendation_only);
  }

  // Filter for 'like' events and get the last 3
  const likes = userEvents
    .filter(e => e.action === 'like')
    .slice(-3);

  if (likes.length === 0) {
    // If no likes, return products in original order (or random)
    return manifest.map(p => ({ ...p, score: 0 }));
  }

  // Get vectors for the last 3 liked products
  const likedVectors = likes
    .map(l => embeddings[l.productId])
    .filter(v => !!v);

  if (likedVectors.length === 0) {
    return manifest.map(p => ({ ...p, score: 0 }));
  }

  // Calculate weights (latest item has highest weight)
  // e.g., for 3 items: [1, 2, 3]
  const weights = likedVectors.map((_, i) => i + 1);

  // Calculate the user preference vector (weighted average)
  const userVector = weightedAverageVectors(likedVectors, weights);

  // Calculate similarity for all products in manifest
  const scoredProducts = manifest.map(product => {
    const productVector = embeddings[product.id];
    const score = productVector ? cosineSimilarity(userVector, productVector) : 0;
    
    return {
      ...product,
      score
    };
  });

  // Sort by score descending
  return scoredProducts.sort((a, b) => b.score - a.score);
}
