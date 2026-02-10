# Latent Space Masking Plan: Isolating Product Style in CLIP Embeddings

## 1. Objective
To improve recommendation accuracy by isolating the dimensions in the CLIP embedding space that represent **product style** (eyewear shape, apparel geometry) and suppressing dimensions that represent **irrelevant context** (model identity, ethnicity, background, lighting).

## 2. Research & References

### A. StyleCLIP: Text-Driven Manipulation of StyleGAN Imagery
*   **Key Insight**: CLIP's latent space contains semantic "directions." By moving a vector along a specific direction, one can modify visual attributes (e.g., adding glasses) while preserving identity.
*   **Application**: We can find the "eyewear direction" by comparing embeddings of the same person with and without different glasses.
*   *Reference*: [Patashnik et al., 2021](https://arxiv.org/abs/2103.17249)

### B. CLAP: Isolating Content from Style
*   **Key Insight**: Standard CLIP embeddings are "entangled." CLAP uses contrastive learning with augmented prompts to disentangle content (identity) from style (visual features).
*   **Application**: Validates the approach of using "augmented" versions of the same image to identify style-invariant vs. style-variant dimensions.
*   *Reference*: [Chefer et al., 2023](https://arxiv.org/abs/2311.16445)

### C. SpLiCE: Sparse Linear Concept Embeddings
*   **Key Insight**: High-dimensional embeddings can be decomposed into sparse linear combinations of human-interpretable concepts.
*   **Application**: Suggests that only a subset of the 512 dimensions in CLIP are actually responsible for "eyewear" or "apparel" features.
*   *Reference*: [Mutas et al., 2024](https://arxiv.org/abs/2402.10376)

---

## 3. Implementation Strategy: "The Difference Mask"

### Phase 1: Data Generation (The "Control" Set)
1.  Select **one** base image from the existing synthetic set.
2.  Use an image-to-image or inpainting model (e.g., Flux Inpainting or "Nano/Banana" editing) to generate **5-10 variants** of this image.
    *   **Constant**: Face, skin, hair, background, lighting.
    *   **Variable**: Eyewear style (Aviator vs. Square), lens color, or apparel type.

### Phase 2: Dimension Discovery (The "Mask" Script)
1.  Generate embeddings for the base image ($V_{base}$) and all variants ($V_1, V_2, ... V_n$).
2.  Calculate the **Variance Vector**: For each of the 512 dimensions, calculate the variance across the set.
    *   **High Variance Dimensions**: Likely represent the product style (since that's the only thing changing).
    *   **Low Variance Dimensions**: Likely represent the identity/background (since those are constant).
3.  Generate a **Weight Mask** ($W$):
    *   $W_i = 1.0$ if dimension $i$ is high-variance.
    *   $W_i = 0.1$ if dimension $i$ is low-variance.

### Phase 3: Engine Integration
1.  Update `lib/vector-math.js` to support **Weighted Cosine Similarity**:
    $$\text{sim}(A, B, W) = \frac{\sum (A_i \cdot W_i) \cdot (B_i \cdot W_i)}{\|A \cdot W\| \cdot \|B \cdot W\|}$$
2.  Apply the mask in `lib/reco-engine.js` during the similarity search.

---

## 4. Success Criteria
*   **Identity Invariance**: Liking a product on a specific model should NOT exclusively recommend other products featuring that same model/ethnicity.
*   **Style Consistency**: Liking "Tortoiseshell Square Frames" should prioritize other square or tortoiseshell items across different models.

## 5. Next Steps
- [ ] Select a "Base Image" for the experiment.
- [ ] Create the "Edit" variants (using external tools or a new script).
- [ ] Implement `scripts/discover_latent_mask.js`.
- [ ] Update recommendation engine with the discovered mask.
