import fs from "node:fs/promises";
import path from "node:path";
import Replicate from "replicate";
import dotenv from "dotenv";
import yaml from "js-yaml";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function main() {
  const repoRoot = process.cwd();
  const productsPath = path.join(repoRoot, "products.yaml");
  const embeddingsPath = path.join(repoRoot, "embeddings.json");
  
  const raw = await fs.readFile(productsPath, "utf8");
  const products = yaml.load(raw);

  const embeddings = {};
  
  // Load existing embeddings if any to avoid re-generating
  try {
    const existing = await fs.readFile(embeddingsPath, "utf8");
    Object.assign(embeddings, JSON.parse(existing));
    console.log(`Loaded ${Object.keys(embeddings).length} existing embeddings.`);
  } catch (err) {
    console.log("No existing embeddings found, starting fresh.");
  }

  for (const item of products) {
    const productId = item.id;
    
    if (embeddings[productId]) {
      console.log(`Skipping ${productId}, already embedded.`);
      continue;
    }

    const absImagePath = path.join(repoRoot, ...item.image_path.split("/"));
    
    console.log(`Generating embedding for ${productId}...`);
    
    try {
      const imageBuffer = await fs.readFile(absImagePath);
      const base64Image = imageBuffer.toString("base64");
      const dataUri = `data:image/jpeg;base64,${base64Image}`;

      // Using openai/clip which returns a 512-dim vector
      const output = await replicate.run(
        "openai/clip",
        {
          input: {
            image: dataUri
          }
        }
      );

      // The output from this model is an object with an 'embedding' property
      if (output && output.embedding) {
        embeddings[productId] = output.embedding;
        console.log(`Successfully embedded ${productId}`);
        
        // Save incrementally
        await fs.writeFile(embeddingsPath, JSON.stringify(embeddings, null, 2));
      } else {
        console.error(`Failed to get vector for ${productId}`, output);
      }
    } catch (err) {
      console.error(`Error embedding ${productId}:`, err.message);
    }
  }

  console.log("Embedding generation complete.");
}

main().catch(console.error);
