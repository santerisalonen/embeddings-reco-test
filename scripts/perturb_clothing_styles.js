import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import Replicate from "replicate";

dotenv.config();

const REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro";

const STYLE_ITEMS = {
  'Bohemian Chic': [
    'Free People peasant top',
    'Crochet vest over tank top',
    'Floral kimono',
    'Tie-dye maxi dress'
  ],
  'Business Casual': [
    'Navy blazer',
    'White Oxford shirt',
    'Cashmere crewneck sweater',
    'Silk blouse'
  ],
  '90s Retro': [
    'Red plaid flannel',
    'Champion cropped hoodie',
    'Nirvana baby tee',
    'Oversized denim jacket'
  ]
};

const STYLES = Object.keys(STYLE_ITEMS);

function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    if (a.startsWith("--") && a.includes("=")) {
      const [k, ...rest] = a.slice(2).split("=");
      args[k] = rest.join("=");
    } else if (a.startsWith("--")) {
      args[a.slice(2)] = true;
    }
  }
  return args;
}

function outputToUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return outputToUrl(output[0]);
  if (typeof output?.url === "function") return output.url();
  if (typeof output?.url === "string") return output.url;
  return null;
}

async function downloadUrlToFile(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
}

function toDataUriJpeg(buffer) {
  const base64 = buffer.toString("base64");
  return `data:image/jpeg;base64,${base64}`;
}

async function makeFluxEdit({ replicate, prompt, inputImageDataUri }) {
  const input = {
    prompt,
    input_image: inputImageDataUri,
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    safety_tolerance: 2,
    prompt_upsampling: false
  };
  const output = await replicate.run(REPLICATE_MODEL, { input });
  const url = outputToUrl(output);
  if (!url) throw new Error("Could not resolve Flux output to a URL");
  return { url };
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const limit = parseInt(args.limit || "1", 10);
  const targetStyleArg = args.targetStyle;

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error("Missing REPLICATE_API_TOKEN");
  }

  const replicate = new Replicate({ auth: replicateToken });

  const productsYamlPath = path.join(repoRoot, "products.yaml");
  const metadataYamlPath = path.join(repoRoot, "products_metadata.yaml");

  const productsRaw = await fs.readFile(productsYamlPath, "utf8");
  const products = yaml.load(productsRaw) || [];
  const metaRaw = await fs.readFile(metadataYamlPath, "utf8");
  const metadata = yaml.load(metaRaw) || {};

  const candidates = products.filter(p => {
    const meta = metadata[p.id];
    return meta && meta.category === 'apparel' && meta.presentation === 'Model';
  });

  if (candidates.length === 0) {
    console.log("No apparel model candidates found.");
    return;
  }

  console.log(`Found ${candidates.length} candidates. Generating up to ${limit} perturbations...`);

  let count = 0;
  for (const candidate of candidates) {
    if (count >= limit) break;

    const meta = metadata[candidate.id];
    const currentStyle = meta.style;
    
    let targetStyle = targetStyleArg;
    if (!targetStyle || !STYLES.includes(targetStyle)) {
      const otherStyles = STYLES.filter(s => s !== currentStyle);
      targetStyle = otherStyles[Math.floor(Math.random() * otherStyles.length)];
    } else if (targetStyle === currentStyle) {
      // Skip if target style is same as current
      continue;
    }

    const targetItem = STYLE_ITEMS[targetStyle][Math.floor(Math.random() * STYLE_ITEMS[targetStyle].length)];
    
    const prompt = `Change the clothing to ${targetItem} in ${targetStyle} style. Keep the same person, face, hair, pose, background, and lighting. Only change the clothing.`;
    
    console.log(`Perturbing ${candidate.id} (${currentStyle}) -> ${targetStyle} with prompt: "${prompt}"`);

    try {
      const absImagePath = path.join(repoRoot, ...candidate.image_path.split("/"));
      const imageBuffer = await fs.readFile(absImagePath);
      const dataUri = toDataUriJpeg(imageBuffer);

      const { url } = await makeFluxEdit({ replicate, prompt, inputImageDataUri: dataUri });
      
      const timestamp = Date.now();
      const newId = `p${timestamp}_${count}`;
      const destPath = `public/products/images/synthetic/${newId}.jpg`;
      const absDestPath = path.join(repoRoot, ...destPath.split("/"));

      await downloadUrlToFile(url, absDestPath);
      console.log(`Saved perturbed image to ${destPath}`);

      const newMeta = { ...meta };
      newMeta.style = targetStyle;
      newMeta.productType = targetItem;
      // Keep other metadata the same
      
      products.push({
        id: newId,
        image_path: destPath,
        category: 'apparel',
        recommendation_only: true // Mark as recommendation only by default for perturbations
      });

      metadata[newId] = newMeta;

      // Save incrementally
      await fs.writeFile(productsYamlPath, yaml.dump(products));
      await fs.writeFile(metadataYamlPath, yaml.dump(metadata));

      count++;
    } catch (err) {
      console.error(`Error perturbing ${candidate.id}:`, err.message);
    }
  }

  console.log(`Perturbation complete. Generated ${count} new items.`);
}

main().catch(console.error);
