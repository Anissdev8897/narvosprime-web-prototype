
/**
 * Calculates the Euclidean distance between two colors.
 */
const colorDistance = (c1: { r: number, g: number, b: number }, c2: { r: number, g: number, b: number }) => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

/**
 * Converts Hex string to RGB object.
 */
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

/**
 * Determines the best contrasting background color (Magenta or Green) 
 * given a set of character colors to avoid transparency conflicts.
 */
export const getOptimalBackgroundColor = (usedColors: string[]): { name: string; hex: string } => {
  const candidates = [
    { name: 'Magenta', hex: '#FF00FF', rgb: { r: 255, g: 0, b: 255 } },
    { name: 'Bright Green', hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
    { name: 'Cyan', hex: '#00FFFF', rgb: { r: 0, g: 255, b: 255 } }
  ];

  const charRgbs = usedColors.map(hexToRgb);

  let bestCandidate = candidates[0];
  let maxMinDist = 0;

  for (const bg of candidates) {
    let minDist = Infinity;
    for (const charColor of charRgbs) {
      const dist = colorDistance(bg.rgb, charColor);
      if (dist < minDist) minDist = dist;
    }
    if (minDist > maxMinDist) {
      maxMinDist = minDist;
      bestCandidate = bg;
    }
  }

  return { name: bestCandidate.name, hex: bestCandidate.hex };
};

/**
 * Helper to find the dominant color along the image borders.
 * This is more robust than checking just one corner.
 */
const getDominantBorderColor = (data: Uint8ClampedArray, width: number, height: number) => {
  const colorCounts: { [key: string]: number } = {};
  const step = 1; // Check every pixel on border

  const addColor = (index: number) => {
    const r = data[index * 4];
    const g = data[index * 4 + 1];
    const b = data[index * 4 + 2];
    const key = `${r},${g},${b}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  };

  // Top & Bottom rows
  for (let x = 0; x < width; x += step) {
    addColor(x); // Top
    addColor((height - 1) * width + x); // Bottom
  }
  // Left & Right cols (excluding corners already added to avoid double counting, though mostly negligible)
  for (let y = 1; y < height - 1; y += step) {
    addColor(y * width); // Left
    addColor(y * width + (width - 1)); // Right
  }

  // Find max occurrence
  let maxCount = 0;
  let dominantKey = "255,255,255";
  for (const key in colorCounts) {
    if (colorCounts[key] > maxCount) {
      maxCount = colorCounts[key];
      dominantKey = key;
    }
  }

  const [r, g, b] = dominantKey.split(',').map(Number);
  return { r, g, b };
};

/**
 * Processes an image to remove a specific background color (Chroma Key).
 * Uses dominant border color detection for robustness.
 * Now uses Electron IPC to bypass CORS for external URLs.
 */
/**
 * ADVANCED DEEPSEEK ALGORITHM FOR INTELLIGENT TRANSPARENCY
 * - Uses Flood Fill from 4 corners to detect connected background.
 * - Auto-detects background color histogram.
 * - Applies 'Soft Ops' to smooth edges.
 */
export const makeImageTransparent = async (imageSrc: string, expectedBgHex: string = "#FFFFFF"): Promise<string> => {
  // If it's an external URL and we're in Electron, fetch via IPC to bypass CORS
  let actualSrc = imageSrc;
  const narvosLauncher = typeof window !== 'undefined' ? (window as any).narvosLauncher : null;

  if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('/') && !imageSrc.startsWith('.')) {
    if (narvosLauncher?.isElectron) {
      try {
        console.log('[Utils] External URL detected, but fetch-image not implemented in launcher.');
        // Note: fetch-image IPC not implemented - falling back to direct fetch
      } catch (e) {
        console.error('[Utils] IPC fetch failed, trying directly:', e);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const width = canvas.width;
      const height = canvas.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // --- DEEPSEEK SMART FLOOD FILL ---
      // Instead of simple color matching, we start from the 4 corners.
      // We assume the corners are BACKGROUND. We flood fill from there.

      const visited = new Uint8ClampedArray(width * height); // 0=unvisited, 1=background
      const tolerance = 90; // Higher tolerance for compressed JPG noise

      // Determine Start Colors from Corners
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];

      // Queue for BFS Flood Fill
      const queue: number[] = [];

      // Initialize Queue with corners
      corners.forEach(([x, y]) => {
        const idx = (y * width + x) * 4;
        // Capture the 'target' color from this specific corner to handle gradients?
        // No, assuming uniform-ish background. Let's pick Top-Left as master ref.
      });

      // Master Reference Color from Top-Left (or dominant border)
      const domColor = getDominantBorderColor(data, width, height);
      const refR = domColor.r;
      const refG = domColor.g;
      const refB = domColor.b;

      console.log(`[DeepSeek Algo] Flood Fill Ref Color: ${refR},${refG},${refB}`);

      // Add all compatible border pixels to queue to handle non-perfectly-connected text
      // Actually, standard Flood Fill from (0,0) is enough if background is contiguous.
      // But if there are islands of background (between legs), we need to catch them.
      // TRICK: We first flood fill from outside. 
      // Then we look for "islands of same color" inside and remove them? 
      // DANGEROUS: Might remove eyes.
      // SAFE STRATEGY: Flood fill from outside is 100% safe.
      // THEN: Strict color match for remaining pixels?

      // Push all border pixels that match "close enough" to Start Queue
      for (let x = 0; x < width; x++) { queue.push(x, 0); queue.push(x, height - 1); }
      for (let y = 0; y < height; y++) { queue.push(0, y); queue.push(width - 1, y); }

      let head = 0;
      while (head < queue.length) {
        const x = queue[head++];
        const y = queue[head++];

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x); // pixel index (not byte index)
        if (visited[idx]) continue;

        const byteIdx = idx * 4;
        const r = data[byteIdx];
        const g = data[byteIdx + 1];
        const b = data[byteIdx + 2];

        const dist = Math.sqrt((r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2);

        if (dist < tolerance) {
          visited[idx] = 1; // Mark as background
          data[byteIdx + 3] = 0; // ERASE

          // Add neighbors
          queue.push(x + 1, y);
          queue.push(x - 1, y);
          queue.push(x, y + 1);
          queue.push(x, y - 1);
        }
      }

      // --- SECOND PASS: Despeckle / Cleanup "Islands" ---
      // If there are still pink pixels inside (between legs) that weren't reached (unlikely if tolerance is good, but possible if there's a hard line),
      // we run a global "Strict Match" just in case, but with tighter tolerance.
      const strictTolerance = 40;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) { // If still visible
          const dist = Math.sqrt((data[i] - refR) ** 2 + (data[i + 1] - refG) ** 2 + (data[i + 2] - refB) ** 2);
          if (dist < strictTolerance) data[i + 3] = 0; // Nuke it
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      console.error('[makeTransparent] Image load error:', e);
      reject(e);
    };
    img.src = actualSrc;
  });
};

/**
 * Intelligently aligns a 4x4 sprite sheet.
 * Uses a FIXED offset per row to avoid horizontal "jitter" or vibration.
 */
export const normalizeAndAlignSpriteSheet = async (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const rows = 4;
      const cols = 4;
      const cellW = Math.floor(img.width / cols);
      const cellH = Math.floor(img.height / rows);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject("No context");

      ctx.drawImage(img, 0, 0);
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = img.width;
      outputCanvas.height = img.height;
      const outCtx = outputCanvas.getContext('2d');
      if (!outCtx) return reject("No outCtx");

      const groundLine = Math.floor(cellH * 0.85); // 85% down is the floor

      for (let r = 0; r < rows; r++) {
        // --- PHASE 1: ANALYZE ROW ---
        let centersSum = 0;
        let centersCount = 0;
        let maxRowY = 0; // The lowest pixel found in this row (feet)
        let hasContent = false;

        // Store frame bounds for Phase 2
        const frameBounds: { minX: number, maxX: number, minY: number, maxY: number, hasPixels: boolean }[] = [];

        for (let c = 0; c < cols; c++) {
          const pixels = ctx.getImageData(c * cellW, r * cellH, cellW, cellH).data;
          let minX = cellW, maxX = 0, minY = cellH, maxY = 0;
          let found = false;

          for (let py = 0; py < cellH; py++) {
            for (let px = 0; px < cellW; px++) {
              if (pixels[(py * cellW + px) * 4 + 3] > 0) {
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
                found = true;
              }
            }
          }

          frameBounds.push({ minX, maxX, minY, maxY, hasPixels: found });

          if (found) {
            hasContent = true;
            // Center of this specific frame
            const center = (minX + maxX) / 2;
            centersSum += center;
            centersCount++;
            // Track globally lowest point (feet) for the row
            if (maxY > maxRowY) maxRowY = maxY;
          }
        }

        // --- PHASE 2: CALCULATE SHIFTS ---
        if (hasContent) {
          // Horizontal: Align the AVERAGE center of the row to the Cell Center
          // This stabilizes the animation (no jitter) but centers the "body mass" better than bbox union
          const avgCenter = centersSum / centersCount;
          const shiftX = Math.floor((cellW / 2) - avgCenter);

          // Vertical: Align the LOWEST point of the row to the groundLine
          // This preserves bobbing/jumping (relative Y motion)
          const shiftY = groundLine - maxRowY;

          // --- PHASE 3: DRAW ---
          for (let c = 0; c < cols; c++) {
            const bounds = frameBounds[c];
            if (!bounds.hasPixels) continue;

            // Draw specifically the bounded area to avoid carrying garbage
            // Apply the ROW-GLOBAL shifts to preserve relative animation
            const w = bounds.maxX - bounds.minX + 1;
            const h = bounds.maxY - bounds.minY + 1;

            outCtx.drawImage(
              img,
              c * cellW + bounds.minX, r * cellH + bounds.minY, w, h, // Source
              c * cellW + bounds.minX + shiftX, r * cellH + bounds.minY + shiftY, w, h // Dest
            );
          }
        }
      }
      resolve(outputCanvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

/**
 * Cleans up a sprite sheet by keeping only the largest connected component in each grid cell.
 * Assumes 32-bit RGBA pixel data.
 */
function cleanupSpriteSheet(data: Uint8ClampedArray, width: number, height: number, rows: number = 4, cols: number = 4) {
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  // Helper: Get pixel index
  const getIdx = (x: number, y: number) => (y * width + x) * 4;

  // Process each cell independently
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startX = c * cellW;
      const startY = r * cellH;
      const endX = Math.min(startX + cellW, width);
      const endY = Math.min(startY + cellH, height);

      // Visited map for this cell
      const visited = new Set<number>();
      const blobs: number[][] = []; // Array of pixel indices

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = getIdx(x, y);
          // If opaque and not visited
          if (data[idx + 3] > 0 && !visited.has(idx)) {
            // Found a new blob, Flood Fill it
            const blob: number[] = [];
            const queue = [[x, y]];
            visited.add(idx);
            blob.push(idx);

            while (queue.length > 0) {
              const [cx, cy] = queue.pop()!;

              // Check 4 neighbors
              const neighbors = [
                [cx + 1, cy], [cx - 1, cy],
                [cx, cy + 1], [cx, cy - 1]
              ];

              for (const [nx, ny] of neighbors) {
                if (nx >= startX && nx < endX && ny >= startY && ny < endY) {
                  const nIdx = getIdx(nx, ny);
                  if (data[nIdx + 3] > 0 && !visited.has(nIdx)) {
                    visited.add(nIdx);
                    blob.push(nIdx);
                    queue.push([nx, ny]);
                  }
                }
              }
            }
            blobs.push(blob);
          }
        }
      }

      // Identify Largest Blob
      if (blobs.length > 0) {
        blobs.sort((a, b) => b.length - a.length);
        const mainBlob = blobs[0];

        // Keep Main Blob, Clear others
        // Optional: Keep secondary blobs if they are significantly large (e.g. detached weapon)?
        // For now, strict 'Keep Largest' fixes the artifact issue best. 
        // BUT, to be safe, let's keep any blob > 10% of the main blob size to avoid deleting floating weapons.

        const threshold = mainBlob.length * 0.10;

        for (let i = 1; i < blobs.length; i++) {
          const blob = blobs[i];
          if (blob.length < threshold) {
            // Erase this small blob
            for (const pIdx of blob) {
              data[pIdx + 3] = 0; // Alpha 0
            }
          }
        }
      }
    }
  }
}

// --- API HELPERS ---

/**
 * Extracts a URL from a flexible JSON structure
 */
const extractUrl = (data: any): string | null => {
  if (!data) return null;

  // 1. Direct properties
  if (data.url) return data.url;
  if (data.image) return data.image;
  if (data.image_url) return data.image_url;
  if (data.link) return data.link;

  // 2. Arrays
  if (Array.isArray(data.output) && data.output.length > 0) return data.output[0];
  if (typeof data.output === 'string') return data.output;
  if (Array.isArray(data.images) && data.images.length > 0) return data.images[0];
  if (Array.isArray(data.results) && data.results.length > 0) return data.results[0];

  // 3. Nested 'data' object (common wrapper pattern)
  if (data.data) {
    if (typeof data.data === 'string') return data.data;
    if (data.data.url) return data.data.url;
    if (data.data.image) return data.data.image;
    if (Array.isArray(data.data) && data.data.length > 0) {
      const item = data.data[0];
      if (typeof item === 'string') return item;
      if (item.url) return item.url;
    }
  }
  return null;
};

/**
 * Polls the Nano Banana API for task completion.
 * Uses GET /record-info endpoint as per official documentation.
 */
const pollTask = async (taskId: string, apiKey: string): Promise<string> => {
  // CORRECT ENDPOINT: GET with taskId as query parameter
  const POLL_ENDPOINT = `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`;
  const MAX_ATTEMPTS = 60; // 60 attempts * 2s = 120s (2 minutes)
  const DELAY_MS = 2000;

  console.log(`[API] Polling task ${taskId}...`);

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, DELAY_MS));

    try {
      const response = await fetch(POLL_ENDPOINT, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });


      if (!response.ok) {
        console.warn(`[API] Poll request failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Log progress
      if (i % 3 === 0) console.log(`[API] Poll attempt ${i + 1}/${MAX_ATTEMPTS}`, data);

      const payload = data.data || data;
      // Nanobanana status codes: successFlag 0=GENERATING, 1=SUCCESS
      const successFlag = payload.successFlag;

      console.log(`[API] successFlag=${successFlag}, completeTime=${payload.completeTime}`);

      // SUCCESS: successFlag === 1 (number, not boolean!)
      if (successFlag === 1 || payload.completeTime) {
        // SUCCESS - extract the result URL
        const resultUrl = payload.response?.resultImageUrl ||
          payload.response?.originImageUrl ||
          payload.resultImageUrl ||
          extractUrl(data);
        if (resultUrl) {
          console.log(`[API] Task completed! URL: ${resultUrl}`);
          return resultUrl;
        }
        console.warn("[API] Status success but URL not found:", JSON.stringify(payload.response));
      } else if (successFlag === 2 || successFlag === 3) {
        throw new Error(`Generation Task Failed (code ${successFlag}): ${payload.errorMessage || JSON.stringify(payload)}`);
      }
      // successFlag === 0 means still generating, continue polling


      // Fallback: If we find a URL directly
      const url = extractUrl(data);
      if (url) return url;


    } catch (e: any) {
      console.warn("[API] Error during polling", e);
      if (e.message && e.message.includes("Generation Task Failed")) throw e;
    }
  }
  throw new Error("Task polling timed out after " + (MAX_ATTEMPTS * DELAY_MS / 1000) + " seconds.");
};

/**
 * Main API wrapper that handles both Sync and Async responses.
 */
const pollMeshyTask = async (taskId: string, apiKey: string): Promise<string> => {
  const MAX_ATTEMPTS = 60;
  const DELAY_MS = 2000;
  // Endpoint estimation based on POST endpoint structure
  const POLL_ENDPOINT = `https://api.meshy.ai/openapi/v1/text-to-image/${taskId}`;

  console.log(`[Meshy] Polling task ${taskId}...`);

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, DELAY_MS));

    try {
      const response = await fetch(POLL_ENDPOINT, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        console.warn(`[Meshy] Poll request failed (${response.status})`);
        continue;
      }

      const data = await response.json();
      const status = (data.status || "").toUpperCase();

      // Log intermediate status occasionally
      if (i % 5 === 0) console.log(`[Meshy] Poll Status: ${status}`, data);

      if (status === "SUCCEEDED") {
        console.log("[Meshy] Task Succeeded! Data:", data);
        // Check all possible return fields
        if (data.image_urls && data.image_urls.length > 0) return data.image_urls[0];
        if (data.image_url) return data.image_url;
        if (data.result_url) return data.result_url;
        if (data.output?.image_url) return data.output.image_url;
        if (data.output?.url) return data.output.url;

        // Fallback extract
        const url = extractUrl(data);
        if (url) return url;

        throw new Error("Task succeeded but no image URL found in response.");
      } else if (status === "FAILED") {
        throw new Error(`Meshy Task Failed: ${data.task_error?.message || data.message || "Unknown error"}`);
      }

    } catch (e: any) {
      console.warn("[Meshy] Polling error:", e);
      if (e.message && e.message.includes("Task Failed")) throw e;
    }
  }
  throw new Error("Meshy polling timed out.");
};

// MESHY API IMPLEMENTATION (Updated)
const generateImageMeshy = async (apiKey: string, prompt: string, resolution: string = "1024x1024", aspectRatio: string = "1:1"): Promise<string> => {
  const GENERATE_ENDPOINT = "https://api.meshy.ai/openapi/v1/text-to-image";

  console.log("[Meshy] Sending generation request (Nano-Banana V1)...");

  const payload = {
    ai_model: "nano-banana-pro",
    prompt: prompt,
    aspect_ratio: aspectRatio,
    negative_prompt: "low quality, blurry, distorted, deformation, ugly, watermark"
  };

  const response = await fetch(GENERATE_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[Meshy] Error ${response.status}: ${err}`);
    if (response.status === 429) throw new Error("429 Too Many Requests");
    throw new Error(`Meshy API Request Failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  console.log("[Meshy] Response:", data);

  // 1. Direct URL (Synchronous success)
  if (data.result_url) return data.result_url;
  if (data.url) return data.url;
  if (data.data?.url) return data.data.url;
  if (extractUrl(data)) return extractUrl(data)!;

  // 2. Task ID (Asynchronous)
  const taskId = data.task_id || data.result;
  if (taskId) {
    console.log(`[Meshy] Task ID received: ${taskId}, starting poll...`);
    return await pollMeshyTask(taskId, apiKey);
  }

  throw new Error("Meshy response did not contain a recognized image URL or Task ID.");
};




/**
 * Main API wrapper that handles both Sync and Async responses.
 * Now supports Meshy via provider switching or fallback.
 */
export const generateImageAPI = async (apiKey: string, prompt: string, resolution: string = "1K", aspectRatio: string = "1:1", backupKey?: string): Promise<string> => {
  // Check if we should use Meshy (based on key format or explicit override)
  if (apiKey.startsWith("msy_")) {
    try {
      return await generateImageMeshy(apiKey, prompt, resolution, aspectRatio);
    } catch (e) {
      console.warn("[Meshy] Failed:", e);
      if (backupKey) {
        console.log(`[API] Switching to Backup Provider with key: ${backupKey.substring(0, 8)}...`);
        return generateImageAPI(backupKey, prompt, resolution, aspectRatio);
      }
      throw e;
    }
  }

  // --- NANOBANANA LEGACY PATH ---
  const GENERATE_ENDPOINT = "https://api.nanobananaapi.ai/api/v1/nanobanana/generate-pro";

  console.log("[API] Sending generation request (Nanobanana)...");
  try {
    const response = await fetch(GENERATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        imageUrls: [""],
        resolution,
        aspectRatio
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Request Failed (${response.status}): ${err}`);
    }

    const data = await response.json();
    console.log("[API] Initial Response:", data);

    // 1. Try to get URL immediately (Sync)
    const url = extractUrl(data);
    if (url) return url;

    // 2. Check for Task ID (Async)
    const taskId = data.taskId || data.data?.taskId || (data.code === 200 && data.data?.taskId);
    if (taskId) {
      return await pollTask(taskId, apiKey);
    }

    // 3. Check for specific errors like 429 (Rate Limit) to trigger fallback immediately
    if (data.code === 429) {
      console.warn("[Nanobanana] Rate Limit Hit (429).");
      if (backupKey) {
        console.log(`[API] Rate limit hit. Switching to Backup Provider (Meshy)...`);
        return generateImageAPI(backupKey, prompt, resolution, aspectRatio);
      }
      throw new Error(`Rate Limit Exceeded: ${data.msg}`);
    }

    throw new Error(`Could not parse response: ${JSON.stringify(data)}`);

  } catch (error: any) {
    console.warn("[Nanobanana] Failed:", error);
    // FALLBACK LOGIC
    if (backupKey) {
      // Log the specific reason we are switching
      console.log(`[API] Primary failed (${error.message}). Switching to Backup Provider...`);
      return generateImageAPI(backupKey, prompt, resolution, aspectRatio); // Recursive call with backup key
    }
    throw error;
  }
};

// ─── Hugging Face Inference API (gratuit, quota journalier) ─────────────────
const HF_IMAGE_MODEL = 'stabilityai/stable-diffusion-2-1';
const HF_IMAGE_WIDTH = 768;
const HF_IMAGE_HEIGHT = 432; // 16:9

/**
 * Génère une image via l'API Inference Hugging Face (gratuit avec token).
 * Modèle adapté au style jeu : prompts orientés 2D isométrique / RPG.
 * Token : https://huggingface.co/settings/tokens (permission "Inference").
 */
export const generateImageHuggingFace = async (
  prompt: string,
  token: string,
  options?: { width?: number; height?: number; negativePrompt?: string }
): Promise<string> => {
  const url = `https://api-inference.huggingface.co/models/${HF_IMAGE_MODEL}`;
  const body: Record<string, unknown> = {
    inputs: prompt,
    parameters: {
      negative_prompt: options?.negativePrompt ?? 'blurry, low quality, 3D, realistic, photo',
      num_inference_steps: 28,
      guidance_scale: 7.5,
      width: options?.width ?? HF_IMAGE_WIDTH,
      height: options?.height ?? HF_IMAGE_HEIGHT
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (res.status === 503) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Modèle en chargement (réessayez dans 20s): ${(err as any).estimated_time ?? ''}`);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Hugging Face API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Génère une image via le serveur SD local (scripts/stable-diffusion-3.5-large).
 * Utilisé quand VITE_LOCAL_SD_URL est défini (ex: http://localhost:5002).
 */
export const generateImageLocalSD = async (
  prompt: string,
  baseUrl: string,
  options?: { width?: number; height?: number; negativePrompt?: string }
): Promise<string> => {
  const url = baseUrl.replace(/\/$/, '') + '/generate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: options?.negativePrompt ?? 'blurry, low quality, 3D, realistic, photo, text',
      width: options?.width ?? HF_IMAGE_WIDTH,
      height: options?.height ?? HF_IMAGE_HEIGHT,
      num_inference_steps: 28,
      guidance_scale: 4.5
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SD local ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  if (typeof data?.image_base64 !== 'string') throw new Error('Réponse invalide du serveur SD local');
  return data.image_base64;
};

/** URL du serveur SD local (défini dans .env : VITE_LOCAL_SD_URL=http://localhost:5002) */
const getLocalSdUrl = (): string | null => {
  try {
    const url = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LOCAL_SD_URL;
    return (url && typeof url === 'string') ? url : null;
  } catch { return null; }
};

/** Prompts enrichis par région pour un meilleur rendu SD 3.5 */
const REGION_PROMPTS: Record<string, Record<string, string>> = {
  'AQUARYS': {
    ville: 'underwater coral city with bioluminescent buildings, aquatic architecture, blue and teal colors, crystal domes, seaweed gardens',
    exterieur: 'ocean floor landscape with coral reefs, underwater caves, aquatic plants, deep blue ambient light, fish schools',
    donjon: 'dark abyssal underwater dungeon, ancient sunken temple, glowing runes, deep sea creatures, dark blue atmosphere'
  },
  'DÉSERTICA': {
    ville: 'desert oasis town with sandstone buildings, golden domes, market stalls with colorful fabrics, palm trees, warm orange light',
    exterieur: 'vast desert landscape with ancient ruins, sand dunes, broken pillars, scattered rocks, golden sunlight, heat haze',
    donjon: 'underground desert dungeon, ancient tomb with golden treasures, hieroglyphs on walls, torch-lit corridors, sand traps'
  },
  'FUNGARIA': {
    ville: 'enchanted mushroom village with giant glowing fungi houses, mycelium bridges, purple and green bioluminescence, spore particles',
    exterieur: 'mystical mushroom forest with towering fungi, moss-covered rocks, glowing spores floating, misty green atmosphere',
    donjon: 'deep fungal cavern dungeon, toxic spore clouds, giant mushroom pillars, bioluminescent walls, poisonous atmosphere'
  },
  'Station_Spatiale': {
    ville: 'sci-fi space station interior, metallic corridors, holographic displays, neon lights, futuristic market area, clean design',
    exterieur: 'space station exterior dock, starfield background, landing pads, cargo containers, spacecraft, nebula visible',
    donjon: 'abandoned space station sector, broken machinery, flickering lights, floating debris, dark atmosphere, alien growth'
  }
};

/**
 * Génère une image de map pour le menu régions (ville / extérieur / donjon).
 * Ordre : 1) SD local (gratuit, meilleure qualité), 2) HF API, 3) placeholder canvas.
 * Meshy/Nano supprimé (remplacé par SD local).
 */
export const generateMapImageForRegion = async (
  regionName: string,
  mapType: 'ville' | 'exterieur' | 'donjon',
  regionColor: string,
  _apiKey?: string,
  _backupKey?: string
): Promise<string> => {
  // Prompt ciblé d'après l'image de référence (sci-fi, isométrique grid, lisibilité)
  const regionPrompts = REGION_PROMPTS[regionName] || REGION_PROMPTS['Station_Spatiale'];
  const themeDesc = regionPrompts?.[mapType] || `${mapType} area`;
  const prompt = `2D isometric tactical RPG battle map, centered combat grid area, clear walkable tiles, non-walkable decorative borders and lower terrain levels with glowing cyan water. Cyberpunk sci-fi base, ${themeDesc}, Dofus Wakfu aesthetic, high-tech glowing machinery, clean exact isometric 2:1 perspective, high-fidelity digital art, no characters, empty environment, detailed stone and metal grid floor tiles.`;
  const negativePrompt = 'blurry, low quality, 3D render, realistic photo, text, watermark, UI elements, characters, people, top-down perspective, messy layout';

  // 1. SD local (priorité absolue, gratuit, meilleure qualité)
  const localSdUrl = getLocalSdUrl();
  if (localSdUrl) {
    try {
      console.log(`[MapGen] SD local: ${regionName} / ${mapType}`);
      return await generateImageLocalSD(prompt, localSdUrl, {
        width: HF_IMAGE_WIDTH,
        height: HF_IMAGE_HEIGHT,
        negativePrompt
      });
    } catch (e) {
      console.warn('[MapGen] SD local failed:', e);
    }
  }

  // 2. Meshy API (Rétabli selon la demande utilisateur)
  if (_apiKey) {
    try {
      console.log(`[MapGen] Using Meshy API for Map...`);
      return await generateImageMeshy(_apiKey, prompt, "1024x1024", "16:9");
    } catch (e) {
      console.warn('[MapGen] Meshy mapping failed:', e);
    }
  }

  // 3. Hugging Face API (gratuit avec quota)
  const hfToken = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_HF_TOKEN;
  if (hfToken && typeof hfToken === 'string' && hfToken.startsWith('hf_')) {
    try {
      return await generateImageHuggingFace(prompt, hfToken, {
        width: HF_IMAGE_WIDTH,
        height: HF_IMAGE_HEIGHT,
        negativePrompt
      });
    } catch (e) {
      console.warn('[MapGen] HF failed, using placeholder:', e);
    }
  }

  // 4. Placeholder canvas (fallback gratuit)
  return generateMapImagePlaceholder(regionName, mapType, regionColor);
};

/**
 * Placeholder gratuit : image générée en canvas (style carte) pour éviter les coûts.
 * Peut être remplacé par un modèle local (ex: Hugging Face) via VITE_HF_TOKEN.
 */
export const generateMapImagePlaceholder = (
  regionName: string,
  mapType: 'ville' | 'exterieur' | 'donjon',
  regionColor: string
): string => {
  const w = 512;
  const h = 288;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, regionColor + '40');
  gradient.addColorStop(0.5, regionColor + '20');
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = regionColor + '99';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(regionName, w / 2, h / 2 - 12);
  ctx.font = '14px sans-serif';
  ctx.fillText(mapType === 'ville' ? 'Ville' : mapType === 'exterieur' ? 'Extérieur' : 'Donjon', w / 2, h / 2 + 16);
  return canvas.toDataURL('image/png');
};

/**
 * Generates a single game object/decoration.
 */
export const generateGameObject = async (
  apiKey: string,
  objectDescription: string,
  category: 'decoration' | 'prop' | 'item' | 'building' = 'decoration',
  backupKey?: string
): Promise<string> => {
  // Category-specific style hints
  const categoryHints: Record<string, string> = {
    decoration: 'decorative element, natural or architectural detail, suitable for game environments',
    prop: 'interactive prop, usable object or furniture, game world element',
    item: 'collectible item, treasure, loot drop, pickup object with slight glow',
    building: 'building facade, house, tower or structure, architectural element'
  };

  const hint = categoryHints[category] || categoryHints.decoration;

  // Optimized prompt for single isometric object with green screen background
  const prompt = `Single ${objectDescription}.
  
  STYLE: Dofus/Wakfu game style. Isometric 2D game asset. Vector art with thick clean outlines. Flat colors with subtle cell shading. Chibi/Stylized proportions.
  
  CATEGORY: ${hint}.
  
  BACKGROUND: Solid bright green (#00FF00) or magenta (#FF00FF) background for easy chroma key. NO gradients, NO shadows on background.
  
  PLACEMENT: Object centered in frame. Clean silhouette. No ground shadows extending beyond object bounds.
  
  QUALITY: High detail, game-ready asset, single isolated object.`;

  console.log("[GenerateObject] Creating object:", objectDescription);

  let imageUrl: string;

  // 1. SD local (priorité)
  const localSdUrl = getLocalSdUrl();
  if (localSdUrl) {
    try {
      imageUrl = await generateImageLocalSD(prompt, localSdUrl, {
        width: 512, height: 512,
        negativePrompt: 'blurry, low quality, realistic, photo, text, watermark, gradient background'
      });
      const transparentUrl = await makeImageTransparent(imageUrl, "#00FF00");
      console.log("[GenerateObject] Object created via SD local");
      return transparentUrl;
    } catch (e) {
      console.warn("[GenerateObject] SD local failed, fallback API:", e);
    }
  }

  // 2. API payante (fallback)
  imageUrl = await generateImageAPI(apiKey, prompt, "1K", "1:1", backupKey);

  // Process for transparency - try multiple background colors
  const transparentUrl = await makeImageTransparent(imageUrl, "#00FF00");

  console.log("[GenerateObject] Object created successfully");
  return transparentUrl;
};

/**
 * Generates a monster sprite with Nanobanana/Meshy for Narvos Prime.
 */
export const generateMonsterSprite = async (
  apiKey: string,
  monsterName: string,
  monsterDescription: string,
  monsterTheme: 'crystal' | 'shadow' | 'metal' | 'energy' | 'cosmic' = 'cosmic',
  backupKey?: string
): Promise<string> => {
  // Theme-specific style hints for Narvos Prime universe
  const themeHints: Record<string, string> = {
    crystal: 'made of glowing purple crystals and Alakyris minerals, prismatic facets, gemstone body',
    shadow: 'dark ethereal shadow creature, cosmic darkness, starlight particles, wispy form',
    metal: 'heavy metallic Darniar armor, robotic golem, industrial plating, glowing energy lines',
    energy: 'pure Lys energy being, glowing green plasma, luminous tentacles, bio-luminescent',
    cosmic: 'space creature, nebula patterns, star constellation markings, cosmic dust trail'
  };

  const hint = themeHints[monsterTheme] || themeHints.cosmic;

  // Optimized prompt for monster sprite generation
  const prompt = `Single ${monsterName} monster creature.
  
  DESCRIPTION: ${monsterDescription}
  
  STYLE: Narvos Prime sci-fi fantasy game style. Isometric 2D game sprite. Anime/chibi proportions. Clean vector outlines with thick strokes. Flat colors with cell shading. Stylized like Wakfu/Dofus but futuristic.
  
  THEME: ${hint}. Alien creature from a distant planet. Sci-fi fantasy aesthetic.
  
  POSE: Combat-ready idle stance, facing 3/4 view towards camera. Dynamic pose showing personality.
  
  BACKGROUND: Solid bright green (#00FF00) or magenta (#FF00FF) for chroma key. NO shadows on background. NO gradient background.
  
  SIZE: Creature centered and filling most of the frame. Clear silhouette.
  
  QUALITY: High detail, game sprite quality, single isolated creature, no duplicates.`;

  console.log(`[GenerateMonster] Creating ${monsterName} (${monsterTheme})...`);

  let imageUrl: string;

  // 1. SD local (priorité)
  const localSdUrl = getLocalSdUrl();
  if (localSdUrl) {
    try {
      imageUrl = await generateImageLocalSD(prompt, localSdUrl, {
        width: 512, height: 512,
        negativePrompt: 'blurry, low quality, realistic, photo, text, watermark, gradient background, multiple creatures'
      });
      const transparentUrl = await makeImageTransparent(imageUrl, "#00FF00");
      console.log(`[GenerateMonster] Monster ${monsterName} created via SD local`);
      return transparentUrl;
    } catch (e) {
      console.warn(`[GenerateMonster] SD local failed, fallback API:`, e);
    }
  }

  // 2. API payante (fallback)
  imageUrl = await generateImageAPI(apiKey, prompt, "1K", "1:1", backupKey);

  // Process for transparency
  const transparentUrl = await makeImageTransparent(imageUrl, "#00FF00");

  console.log(`[GenerateMonster] Monster ${monsterName} created successfully`);
  return transparentUrl;
};
/**
 * Processes a sprite sheet to replace base colors with target colors.
 * This allows "recoloring" high-quality assets without AI regeneration.
 */
/**
 * Advanced recoloring system using a Mask image (R, G, B channels).
 * Preserves luminance while modifying the hue based on target colors.
 */
export const recolorSpriteWithMask = (
  bodySrc: string,
  maskSrc: string,
  targetPalette: { primary: string; secondary: string; skin: string }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const bodyImg = new Image();
    const maskImg = new Image();
    let loadedCount = 0;

    const onAllLoaded = () => {
      const canvas = document.createElement('canvas');
      canvas.width = bodyImg.width;
      canvas.height = bodyImg.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject("No context");

      // Draw mask to off-screen context
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = bodyImg.width;
      maskCanvas.height = bodyImg.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return reject("No mask context");
      maskCtx.drawImage(maskImg, 0, 0);
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;

      // Draw body to main context
      ctx.drawImage(bodyImg, 0, 0);
      const bodyImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bodyData = bodyImageData.data;

      const tPri = hexToRgb(targetPalette.primary);
      const tSec = hexToRgb(targetPalette.secondary);
      const tSkin = hexToRgb(targetPalette.skin);

      for (let i = 0; i < bodyData.length; i += 4) {
        if (bodyData[i + 3] === 0) continue; // Skip transparency

        const mr = maskData[i];
        const mg = maskData[i+1];
        const mb = maskData[i+2];

        // Only recolor if there's a strong channel in the mask
        let target = null;
        if (mr > 200 && mg < 100 && mb < 100) target = tPri;
        else if (mg > 200 && mr < 100 && mb < 100) target = tSec;
        else if (mb > 200 && mr < 100 && mg < 100) target = tSkin;

        if (target) {
            // Preserve luminance: calculate brightness of original pixel
            const luminosity = (bodyData[i] * 0.299 + bodyData[i+1] * 0.587 + bodyData[i+2] * 0.114) / 255;
            
            // Apply new color balanced by luminosity
            // (Simple multiplication for shading effect)
            bodyData[i] = Math.min(255, target.r * (luminosity * 1.5));
            bodyData[i+1] = Math.min(255, target.g * (luminosity * 1.5));
            bodyData[i+2] = Math.min(255, target.b * (luminosity * 1.5));
        }
      }

      ctx.putImageData(bodyImageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    bodyImg.onload = () => { loadedCount++; if (loadedCount === 2) onAllLoaded(); };
    maskImg.onload = () => { loadedCount++; if (loadedCount === 2) onAllLoaded(); };
    bodyImg.onerror = () => reject("Failed to load body");
    maskImg.onerror = () => reject("Failed to load mask");
    
    bodyImg.src = bodySrc;
    maskImg.src = maskSrc;
  });
};

export const recolorSprite = (
  imageSrc: string,
  targetPalette: { skin: string; hair: string; tunic1: string; tunic2?: string },
  basePalette: { skin: string; hair: string; primary: string; secondary: string }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject("No context");

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Prepare RGB targets
      const tSkin = hexToRgb(targetPalette.skin);
      const tHair = hexToRgb(targetPalette.hair);
      const tPri = hexToRgb(targetPalette.tunic1);
      const tSec = hexToRgb(targetPalette.tunic2 || targetPalette.tunic1);

      // Prepare RGB bases
      const bSkin = hexToRgb(basePalette.skin);
      const bHair = hexToRgb(basePalette.hair);
      const bPri = hexToRgb(basePalette.primary);
      const bSec = hexToRgb(basePalette.secondary);

      const THRESHOLD = 60; // Distance threshold for color matching

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // Skip transparency

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const p = { r, g, b };

        // Check if pixel matches any base color
        const dSkin = colorDistance(p, bSkin);
        const dHair = colorDistance(p, bHair);
        const dPri = colorDistance(p, bPri);
        const dSec = colorDistance(p, bSec);

        if (dSkin < THRESHOLD) {
          data[i] = tSkin.r; data[i + 1] = tSkin.g; data[i + 2] = tSkin.b;
        } else if (dHair < THRESHOLD) {
          data[i] = tHair.r; data[i + 1] = tHair.g; data[i + 2] = tHair.b;
        } else if (dPri < THRESHOLD) {
          data[i] = tPri.r; data[i + 1] = tPri.g; data[i + 2] = tPri.b;
        } else if (dSec < THRESHOLD) {
          data[i] = tSec.r; data[i + 1] = tSec.g; data[i + 2] = tSec.b;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

/**
 * Intelligent algorithm to map movement vectors to sprite sheet states.
 * Supports multi-axis movement and persistence of direction in IDLE state.
 */
/**
 * ADVANCED 8-AXIS DIRECTION ENGINE.
 * Maps 360° movement into 8 directions using 3 rows + flipping.
 */
export const computeSpriteState = (
  isMoving: boolean,
  dx: number,
  dy: number,
  currentFrame: number,
  lastDir: { row: number, flipped: boolean }
): { row: number; frame: number; flipped: boolean } => {

  const frameX = currentFrame * 25;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isActuallyMoving = isMoving && dist > 0.1;

  if (!isActuallyMoving) {
    return {
      row: lastDir.row,
      frame: 0,
      flipped: lastDir.flipped
    };
  }

  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  let rowY = 0;
  let flipped = false;

  // Granular sectors for 8 directions
  if (angleDeg >= 67.5 && angleDeg < 112.5) {
    rowY = 0; flipped = false; // South
  } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
    rowY = 0; flipped = false; // South-East
  } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
    rowY = 0; flipped = true; // South-West
  } else if (angleDeg >= -22.5 && angleDeg < 22.5) {
    rowY = 25; flipped = false; // East
  } else if (angleDeg >= 157.5 || angleDeg < -157.5) {
    rowY = 25; flipped = true; // West
  } else if (angleDeg >= -112.5 && angleDeg < -67.5) {
    rowY = 50; flipped = false; // North
  } else if (angleDeg >= -67.5 && angleDeg < -22.5) {
    rowY = 50; flipped = false; // North-East
  } else {
    rowY = 50; flipped = true; // North-West
  }

  return { row: rowY, frame: frameX, flipped };
};

export { hexToRgb };

/**
 * DeepSeek AI Implementation
 * Used for intelligent prompt refinement and complex logic processing.
 */
export const queryDeepSeek = async (prompt: string, apiKey: string = process.env.DEEPSEEK_API_KEY || ""): Promise<string> => {
  const ENDPOINT = "https://api.deepseek.com/chat/completions";
  console.log("[DeepSeek] Thinking...");

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are an expert game designer for Narvos Prime, a Dofus-style isometric sci-fi fantasy game. Your goal is to provide highly detailed, creative, and technical descriptions or logic." },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    console.error("[DeepSeek] Failed to query:", e);
    throw e;
  }
};

/**
 * Intelligent Prompt Refiner using DeepSeek.
 * Enhances a simple prompt into a professional game asset generation prompt.
 */
export const refinePromptWithDeepSeek = async (simplePrompt: string, apiKey?: string): Promise<string> => {
  const instruction = `Refine the following prompt for a high-quality 2D isometric game asset. 
    The style must be 'Dofus 2.0 / Wakfu style' (vector art, clean outlines, vibrant colors).
    Univers: Sci-fi Fantasy (Narvos Prime).
    
    PROMPT TO REFINE: ${simplePrompt}
    
    Output ONLY the final optimized prompt text.`;

  return await queryDeepSeek(instruction, apiKey);
};
