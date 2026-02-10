import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

async function main() {
  const repoRoot = process.cwd();
  const syntheticDir = path.join(repoRoot, "public", "products", "images", "synthetic");
  const productsYamlPath = path.join(repoRoot, "products.yaml");
  const metadataPath = path.join(repoRoot, "products_metadata.yaml");

  try {
    // Load metadata to get categories
    let metadata = {};
    try {
      const rawMeta = await fs.readFile(metadataPath, "utf8");
      metadata = yaml.load(rawMeta) || {};
    } catch (err) {
      console.warn("Warning: products_metadata.yaml not found. Categories will default to 'apparel'.");
    }

    const files = await fs.readdir(syntheticDir);
    const imageFiles = files.filter(f => f.endsWith(".jpg"));

    console.log(`Found ${imageFiles.length} synthetic images.`);

    // Sort to be deterministic
    imageFiles.sort();

    const products = imageFiles.map((file, index) => {
      const id = file.replace(".jpg", "");
      
      // Make all items visible in the catalog for this demo.
      const isRecommendationOnly = false;
      
      // Get category from metadata or default to apparel
      const category = metadata[id]?.category || (id.startsWith('e') ? 'eyewear' : 'apparel');
      
      return {
        id: id,
        image_path: `public/products/images/synthetic/${file}`,
        recommendation_only: isRecommendationOnly,
        category: category
      };
    });

    await fs.writeFile(productsYamlPath, yaml.dump(products));
    console.log(`Successfully rebuilt products.yaml with ${products.length} items.`);
    console.log(`${products.filter(p => p.recommendation_only).length} items marked as recommendation-only.`);

  } catch (err) {
    console.error("Error rebuilding products.yaml:", err.message);
  }
}

main().catch(console.error);
