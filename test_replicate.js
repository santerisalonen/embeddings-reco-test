import Replicate from "replicate";
import 'dotenv/config';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const input = {
  image: "https://replicate.delivery/pbxt/NSJXgUa7RjiqoPi4bmYjeHZs0PsaOyJv0USNgXOrUxXJU7UF/clip%20cover.webp"
};

try {
  console.log("Running Replicate CLIP model...");
  const output = await replicate.run("openai/clip", { input });
  console.log("Output:", output);
} catch (error) {
  console.error("Error running Replicate:", error);
}
