import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

async function main() {
  const repoRoot = process.cwd();
  const productsYamlPath = path.join(repoRoot, "products.yaml");

  try {
    const raw = await fs.readFile(productsYamlPath, "utf8");
    const products = yaml.load(raw) || [];

    if (products.length === 0) {
      console.log("No products found in products.yaml.");
      return;
    }

    console.log(`Reshuffling recommendation_only flags for ${products.length} products...`);

    // Shuffle the array to randomly assign flags
    const shuffled = [...products].sort(() => Math.random() - 0.5);

    // Assign 1/3 as recommendation_only: true, others false
    const updatedProducts = shuffled.map((product, index) => {
      return {
        ...product,
        recommendation_only: index < products.length / 3
      };
    });

    // Sort back by ID to keep the file somewhat organized
    updatedProducts.sort((a, b) => a.id.localeCompare(b.id));

    await fs.writeFile(productsYamlPath, yaml.dump(updatedProducts));
    
    const recoOnlyCount = updatedProducts.filter(p => p.recommendation_only).length;
    console.log(`Successfully reshuffled flags.`);
    console.log(`${recoOnlyCount} items marked as recommendation-only.`);
    console.log(`${updatedProducts.length - recoOnlyCount} items marked as catalog-visible.`);

  } catch (err) {
    console.error("Error reshuffling flags:", err.message);
  }
}

main().catch(console.error);
