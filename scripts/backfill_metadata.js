import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

async function main() {
  const repoRoot = process.cwd();
  const metadataPath = path.join(repoRoot, "products_metadata.yaml");

  try {
    const raw = await fs.readFile(metadataPath, "utf8");
    const metadata = yaml.load(raw) || {};
    
    let updatedCount = 0;
    for (const id in metadata) {
      if (!metadata[id].category) {
        // Based on IDs starting with 's' for synthetic apparel
        if (id.startsWith('s')) {
          metadata[id].category = 'apparel';
          updatedCount++;
        } else if (id.startsWith('e')) {
          metadata[id].category = 'eyewear';
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await fs.writeFile(metadataPath, yaml.dump(metadata));
      console.log(`Successfully backfilled category for ${updatedCount} items in products_metadata.yaml.`);
    } else {
      console.log("No items needed backfilling in products_metadata.yaml.");
    }
  } catch (err) {
    console.error("Error backfilling metadata:", err.message);
  }
}

main().catch(console.error);
