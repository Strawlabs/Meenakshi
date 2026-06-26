/**
 * Meenakshi — Gemini API Service
 * ==============================
 * Direct cross-platform fetch wrapper for Google Gemini API.
 * Guarantees serial execution of all API calls using a promise chain request queue,
 * spacing consecutive requests by at least 4000ms to stay within the 10 RPM limit.
 * Implements an automatic model fallback chain to recover from quota depletion (429).
 */

interface GeminiGenerateConfig {
  responseMimeType?: string;
  systemInstruction?: string;
  model?: string;
  imagePart?: {
    mimeType: string;
    data: string;
  };
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// Fallback models in priority order to recover if free quotas deplete
const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash'
];

// Request queue chain to execute Gemini requests sequentially
let queueChain: Promise<any> = Promise.resolve();
let lastRequestTime = 0;

/**
 * Helper to queue requests and space them out by at least 4000ms.
 */
async function runQueuedRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handleNext = async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      const delayNeeded = 4000 - elapsed;
      if (delayNeeded > 0) {
        console.log(`[geminiService] Request queue pacing. Waiting ${delayNeeded}ms...`);
        await new Promise(r => setTimeout(r, delayNeeded));
      }
      lastRequestTime = Date.now();
      return await fn();
    };

    queueChain = queueChain
      .then(async () => {
        try {
          const result = await handleNext();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })
      .catch(async () => {
        // Continue chain even if previous request failed
        try {
          const result = await handleNext();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
  });
}

/**
 * Direct cross-platform fetch wrapper for Google Gemini API.
 * Bypasses library bundling issues and works seamlessly on Web, iOS, and Android.
 */
export async function generateGeminiContent(
  prompt: string,
  config?: GeminiGenerateConfig
): Promise<string> {
  return runQueuedRequest(async () => {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
    }

    const requestedModel = config?.model || 'gemini-3-flash-preview';

    // Create a list of models to try, placing the requested one first
    const modelsToTry = [
      requestedModel,
      ...FALLBACK_MODELS.filter(m => m !== requestedModel)
    ];

    const parts: any[] = [{ text: prompt }];

    if (config?.imagePart) {
      parts.push({
        inlineData: {
          mimeType: config.imagePart.mimeType,
          data: config.imagePart.data
        }
      });
    }

    const bodyPayload: any = {
      contents: [
        {
          parts,
        },
      ],
    };

    if (config?.systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [
          {
            text: config.systemInstruction,
          },
        ],
      };
    }

    if (config?.responseMimeType) {
      bodyPayload.generationConfig = {
        responseMimeType: config.responseMimeType,
      };
    }

    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      try {
        console.log(`[geminiService] Attempting generateContent with model: ${currentModel}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`;

        const maxAttempts = 3; // Retry transient errors up to 3 times per model
        let attempt = 0;
        let delay = 2000;
        let modelResult: string | null = null;

        while (attempt < maxAttempts) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(bodyPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const json = await response.json();

            if (!response.ok) {
              const isRateLimit = response.status === 429 || response.status === 503;
              const errorMsg = json.error?.message || response.statusText;
              const isQuotaExceeded = errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('limit');

              console.warn(
                `[geminiService] Request failed with model ${currentModel} (attempt ${attempt + 1}/${maxAttempts}, status: ${response.status}):`,
                json
              );

              // If it's a permanent quota error, stop retrying this model and try fallback model immediately
              if (isQuotaExceeded) {
                console.log(`[geminiService] Quota exceeded for model ${currentModel}. Falling back...`);
                throw new Error(`Quota limit: ${errorMsg}`);
              }

              if (isRateLimit && attempt < maxAttempts - 1) {
                const backoff = delay * Math.pow(2, attempt) + Math.random() * 1000;
                console.log(`[geminiService] Rate limit hit. Retrying model ${currentModel} in ${Math.round(backoff)}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                attempt++;
                continue;
              }

              throw new Error(
                `Gemini API Error: ${errorMsg}`
              );
            }

            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
              throw new Error('Gemini returned an empty response.');
            }

            modelResult = text;
            break; // Exit retry loop on success
          } catch (error: any) {
            const errorMsg = error.message || '';
            const isTransient = errorMsg.includes('429') ||
              errorMsg.includes('503') ||
              errorMsg.includes('Network request failed') ||
              errorMsg.includes('Failed to fetch');

            const isQuotaExceeded = errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('limit');

            if (isTransient && !isQuotaExceeded && attempt < maxAttempts - 1) {
              const backoff = delay * Math.pow(2, attempt) + Math.random() * 1000;
              console.warn(`[geminiService] Transient error encountered. Retrying model ${currentModel} in ${Math.round(backoff)}ms... Error:`, error.message);
              await new Promise(resolve => setTimeout(resolve, backoff));
              attempt++;
              continue;
            }

            throw error;
          }
        }

        if (modelResult) {
          return modelResult;
        }
      } catch (err: any) {
        console.warn(`[geminiService] Model ${currentModel} failed. Falling back to the next available model... Error:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini fallback models exhausted.');
  });
}
