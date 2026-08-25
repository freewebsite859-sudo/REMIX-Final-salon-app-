import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '32kb' }));

// AI routes spend a server-side provider quota. Keep an abusive client from
// exhausting the Gemini key; a distributed production deployment should add
// an edge/API-gateway limit as well.
const aiRateWindowMs = 60_000;
const aiRateLimit = 30;
const aiRateBuckets = new Map<string, { startedAt: number; count: number }>();
function limitAiRequests(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = aiRateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= aiRateWindowMs) {
    aiRateBuckets.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > aiRateLimit) {
    res.status(429).json({ success: false, error: 'Too many AI requests. Try again shortly.' });
    return;
  }
  next();
}
app.use('/api/salons', limitAiRequests);

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function aiUnavailable(res: Response, message = "AI service is not configured") {
  return res.status(503).json({ success: false, error: message });
}

function aiFailed(res: Response) {
  return res.status(502).json({
    success: false,
    error: "AI service is temporarily unavailable. No recommendation was generated.",
  });
}

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Google Maps Grounded Salon Discovery
app.post("/api/salons/grounded-search", async (req: Request, res: Response) => {
  const { query, latitude, longitude, areaName, category } = req.body;
  const searchArea = typeof areaName === 'string' && areaName.trim() ? areaName.trim() : 'your area';
  const userLat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null;
  const userLng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null;
  const searchQuery =
    typeof query === 'string' && query.trim()
      ? query.trim()
      : typeof category === 'string' && category.trim()
      ? category.trim()
      : 'top rated hair salons, spas, and beauty studios';

  if (!ai) {
    return aiUnavailable(res);
  }

  try {
    const coordinateHint = userLat !== null && userLng !== null
      ? ` (coordinates: ${userLat}, ${userLng})`
      : '';
    const prompt = `You are Nexora SalonOS AI Grounding Assistant. The user is looking for salons or beauty services in/near ${searchArea}${coordinateHint}.
User query: "${searchQuery}".
Provide a concise, helpful summary highlighting top rated salons, specific specialties (haircuts, styling, facials, bridal, nails, spa), typical pricing, opening status, and why customers love them. Include exact salon names and addresses when available. Do not invent a business, price, review, or distance.`;

    const mapsConfig = userLat !== null && userLng !== null
      ? {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: { latLng: { latitude: userLat, longitude: userLng } },
          },
        }
      : { tools: [{ googleMaps: {} }] };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: mapsConfig,
    });

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return res.json({
      success: true,
      source: "gemini_google_maps_grounding",
      text: response.text || "",
      groundingChunks,
    });
  } catch (err: any) {
    console.warn("Grounded search error:", err?.message || err);
    return aiFailed(res);
  }
});

// AI Beauty & Stylist Advisor (maps-grounded recommendation)
app.post("/api/salons/ai-advisor", async (req: Request, res: Response) => {
  const { userPrompt, preferences, location } = req.body;
  const userLoc = typeof location?.area === 'string' && location.area.trim() ? location.area.trim() : 'your area';
  const userLat = typeof location?.latitude === 'number' && Number.isFinite(location.latitude) ? location.latitude : null;
  const userLng = typeof location?.longitude === 'number' && Number.isFinite(location.longitude) ? location.longitude : null;

  if (!ai) {
    return aiUnavailable(res);
  }

  try {
    const coordinateHint = userLat !== null && userLng !== null
      ? ` (coordinates: ${userLat}, ${userLng})`
      : '';
    const prompt = `You are Nexora's Elite Salon & Beauty Consultant. A client in ${userLoc}${coordinateHint} is asking for personalized salon and treatment recommendations.
User Query: "${typeof userPrompt === 'string' ? userPrompt.slice(0, 1000) : ''}".
Client Preferences: ${JSON.stringify(preferences || {}).slice(0, 4000)}.
Give an expert recommendation based only on verifiable information. Do not invent a business, price, review, or distance.`;

    const mapsConfig = userLat !== null && userLng !== null
      ? {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: { latLng: { latitude: userLat, longitude: userLng } },
          },
        }
      : { tools: [{ googleMaps: {} }] };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: mapsConfig,
    });

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return res.json({
      success: true,
      text: response.text || '',
      groundingChunks,
    });
  } catch (err: any) {
    console.warn("AI Advisor error:", err?.message || err);
    return aiFailed(res);
  }
});

// AI Style Quiz (Face Shape, Hair Type & Desired Length Analysis)
app.post("/api/salons/ai-style-quiz", async (req: Request, res: Response) => {
  const { hairType, desiredLength, faceShape, stylingGoal, location } = req.body;
  const userLoc = typeof location?.area === 'string' && location.area.trim() ? location.area.trim() : 'your area';
  const userLat = typeof location?.latitude === 'number' && Number.isFinite(location.latitude) ? location.latitude : null;
  const userLng = typeof location?.longitude === 'number' && Number.isFinite(location.longitude) ? location.longitude : null;

  const hType = typeof hairType === 'string' && hairType.trim() ? hairType.trim() : "Wavy";
  const dLength = typeof desiredLength === 'string' && desiredLength.trim() ? desiredLength.trim() : "Shoulder Length";
  const fShape = typeof faceShape === 'string' && faceShape.trim() ? faceShape.trim() : "Oval";
  const sGoal = typeof stylingGoal === 'string' && stylingGoal.trim() ? stylingGoal.trim() : "Volume & Movement";

  // Deterministic style guidance used only to shape the response fields; it
  // contains no salon, service, price, review, or distance data.
  const getStyleGuidanceTemplate = () => {
    let faceShapeAnalysis = "";
    let hairTypeSuitability = "";
    let cuts: string[] = [];
    let homeTips: string[] = [];

    if (fShape.toLowerCase().includes("round")) {
      faceShapeAnalysis = `For a Round face shape, styles with vertical dimension, crown volume, and diagonal face-framing layers elongate the face silhouette and create high-fashion angularity.`;
      cuts = ["Long Textured Butterfly Layers", "Collarbone Lob with Soft Curtain Fringe", "Deep Side-Parted Voluminous Blowout"];
    } else if (fShape.toLowerCase().includes("square")) {
      faceShapeAnalysis = `For a Square face shape with a prominent jawline, soft wispy layers, gentle curtain bangs, and rounded textures soften perimeter angles gracefully.`;
      cuts = ["Soft Wispy Layered Cut", "Shoulder-Grazing Shag with Feathered Ends", "Cascading Face-Framing Waves"];
    } else if (fShape.toLowerCase().includes("heart")) {
      faceShapeAnalysis = `For a Heart face shape (wider forehead, delicate chin), chin-length bobs or collarbone layers with lower volume balance proportions effortlessly.`;
      cuts = ["Chin-Grazing French Textured Bob", "Bottleneck Bangs with Mid-Length Waves", "Low-Density Textured Waves"];
    } else if (fShape.toLowerCase().includes("diamond")) {
      faceShapeAnalysis = `For a Diamond face shape with high sculpted cheekbones, side-swept bangs and shoulder-length volume highlight natural contours without widening cheek area.`;
      cuts = ["Side-Swept Feathered Layers", "Mid-Length Collarbone Cut", "Soft Beach Wave Styling"];
    } else {
      // Oval or default
      faceShapeAnalysis = `An Oval face shape is the most versatile archetype, beautifully suited for symmetric parting, bold curtain fringes, and dynamic layer graduation.`;
      cuts = ["Signature Multi-Tier Layer Shaping", "Curtain Bangs with Bouncy Blowout", "Gloss Balayage with Silk Smooth Cut"];
    }

    if (hType.toLowerCase().includes("curl") || hType.toLowerCase().includes("coil")) {
      hairTypeSuitability = `With your ${hType} texture and ${dLength} target, dry-cutting techniques, moisture infusion, and perimeter weight distribution prevent triangular shapes and unlock curl definition.`;
      homeTips = [
        "Use a microfiber towel or cotton wrap post-wash to preserve curl clumping.",
        "Apply leave-in curl cream on soaking wet hair followed by diffusing on medium heat.",
        "Schedule a moisture bond-repair spa every 3-4 weeks for bouncy elasticity."
      ];
    } else if (hType.toLowerCase().includes("wavy")) {
      hairTypeSuitability = `Your ${hType} hair has natural movement and bounce. Tailoring ${dLength} with weight-relief internal texturizing elevates body without daily high-heat stress.`;
      homeTips = [
        "Incorporate a lightweight sea-salt spray or texturizing mousse for effortless beach waves.",
        "Use a wide-tooth detangling comb in the shower while conditioner is active.",
        "Protect hair with thermal spray before any heated styling tool."
      ];
    } else {
      hairTypeSuitability = `For ${hType} hair looking for ${dLength}, precision blunt perimeters combined with interior micro-layers add natural volume and eliminate flatness.`;
      homeTips = [
        "Use a root-lifting spray at crown level before blow-drying for all-day bounce.",
        "Opt for a clarifying shampoo once every 10 days to remove product buildup.",
        "Finish with a drop of argan oil on the tips for mirror-finish shine."
      ];
    }

    return {
      styleSummary: `Style guidance for ${fShape} face shape, ${hType} hair texture, aiming for ${dLength} with a focus on ${sGoal}.`,
      faceShapeAnalysis,
      hairTypeSuitability,
      recommendedCutsAndStyles: cuts,
      recommendedServices: [],
      homeCareTips: homeTips,
      groundingSources: [],
    };
  };

  const styleGuidanceTemplate = getStyleGuidanceTemplate();

  if (!ai) {
    return aiUnavailable(res);
  }

  try {
    const prompt = `You are Nexora's Master Stylist & AI Hair Architect. Analyze this client profile and provide a thorough style recommendation:
- Face Shape: ${fShape}
- Hair Type/Texture: ${hType}
- Desired Length: ${dLength}
- Styling Goal: ${sGoal}
- Client Location: ${userLoc}${userLat !== null && userLng !== null ? ` (coordinates: ${userLat}, ${userLng})` : ''}

Provide:
1. Face shape optical analysis (how this cut balances jawline, cheekbones, and forehead).
2. Hair type and texture suitability (layering technique, density management).
3. 3 specific haircut/styling names that flatter this combination.
4. 3 professional home care / maintenance recommendations.
5. Overall summary.
Do not invent salon names, services, prices, reviews, or distances.

Format your response as structured advice.`;

    const mapsConfig = userLat !== null && userLng !== null
      ? {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: { latLng: { latitude: userLat, longitude: userLng } },
          },
        }
      : { tools: [{ googleMaps: {} }] };

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: mapsConfig,
    });

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const generatedText = response.text || "";

    // The AI may explain style considerations, but it must not invent a
    // salon, service, price, or duration. Those recommendations come only
    // from the canonical catalog (which this endpoint does not query).
    const result = {
      styleSummary: generatedText ? generatedText.slice(0, 300).replace(/^[#*\s]+/, "") : "Style guidance generated.",
      faceShapeAnalysis: styleGuidanceTemplate.faceShapeAnalysis,
      hairTypeSuitability: styleGuidanceTemplate.hairTypeSuitability,
      recommendedCutsAndStyles: styleGuidanceTemplate.recommendedCutsAndStyles,
      recommendedServices: [],
      homeCareTips: styleGuidanceTemplate.homeCareTips,
      aiDetailedAdvice: generatedText,
      groundingSources: groundingChunks,
    };

    return res.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.warn("AI Style Quiz error:", err?.message || err);
    return aiFailed(res);
  }
});

// AI Salon Review Sentiment Summary Endpoint
app.post("/api/salons/sentiment-summary", async (req: Request, res: Response) => {
  const { salonId, salonName, reviews = [], location } = req.body;
  const targetSalonName = salonName || "Nexora Salon";
  const userLoc = location?.area || "Mansarovar, Jaipur";

  if (!ai) {
    return aiUnavailable(res);
  }

  try {
    const reviewsContext = reviews
      .map(
        (r: any, idx: number) =>
          `[Review ${idx + 1}] (${r.rating}★ by ${r.userName} on ${r.serviceUsed || "Service"}): "${r.comment}"`
      )
      .join("\n");

    const prompt = `You are Nexora's AI Salon Review Sentiment & Reputation Architect.
Analyze the customer feedback for salon: "${targetSalonName}" located in ${userLoc}.

Customer Reviews to analyze:
${reviewsContext || "No review data was supplied. Return an analysis that clearly indicates there is insufficient evidence."}

Provide a comprehensive, structured Sentiment Summary in valid JSON format matching this exact schema:
{
  "overallSentiment": "Overwhelmingly Positive" | "Very Positive" | "Mostly Positive" | "Mixed",
  "sentimentScore": number (0-100),
  "positivePercentage": number,
  "neutralPercentage": number,
  "negativePercentage": number,
  "executiveSummary": "2-3 concise sentences summarizing customer sentiment and key strengths",
  "topPositiveThemes": [
    {
      "theme": "Theme title",
      "percentage": number,
      "mentionsCount": number,
      "sampleQuote": "Direct quote from reviews",
      "tag": "e.g. Artistry, Cleanliness, Service"
    }
  ],
  "topNegativeThemes": [
    {
      "theme": "Constructive theme or area for improvement",
      "percentage": number,
      "mentionsCount": number,
      "sampleQuote": "Direct quote or constructive feedback",
      "recommendation": "Helpful tip for new clients (e.g. book weekday mornings)",
      "tag": "e.g. Wait Time, Parking, Booking"
    }
  ],
  "standoutStylists": ["Stylist Name (Role)"],
  "bestForServices": ["Service Name 1", "Service Name 2"],
  "vibeBadge": "Short 3-5 word signature vibe phrase"
}
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text?.trim() || "";
    let parsedData = null;

    try {
      parsedData = JSON.parse(jsonText);
    } catch {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      }
    }

    if (parsedData && typeof parsedData.executiveSummary === 'string') {
      const allowedSentiments = ['Overwhelmingly Positive', 'Very Positive', 'Mostly Positive', 'Mixed'];
      const numberOrZero = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
      const arrayOrEmpty = (value: unknown) => (Array.isArray(value) ? value : []);
      const sentiment = {
        salonId,
        salonName: targetSalonName,
        overallSentiment: allowedSentiments.includes(parsedData.overallSentiment)
          ? parsedData.overallSentiment
          : 'Mixed',
        sentimentScore: Math.max(0, Math.min(100, numberOrZero(parsedData.sentimentScore))),
        positivePercentage: Math.max(0, Math.min(100, numberOrZero(parsedData.positivePercentage))),
        neutralPercentage: Math.max(0, Math.min(100, numberOrZero(parsedData.neutralPercentage))),
        negativePercentage: Math.max(0, Math.min(100, numberOrZero(parsedData.negativePercentage))),
        executiveSummary: parsedData.executiveSummary,
        topPositiveThemes: arrayOrEmpty(parsedData.topPositiveThemes),
        topNegativeThemes: arrayOrEmpty(parsedData.topNegativeThemes),
        standoutStylists: arrayOrEmpty(parsedData.standoutStylists),
        bestForServices: arrayOrEmpty(parsedData.bestForServices),
        vibeBadge: typeof parsedData.vibeBadge === 'string' ? parsedData.vibeBadge : '',
        analyzedReviewCount: reviews.length,
      };
      return res.json({ success: true, sentiment });
    }

    return aiFailed(res);
  } catch (err: any) {
    console.warn("AI Sentiment Summary error:", err?.message || err);
    return aiFailed(res);
  }
});

// Start Server with Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexora SalonOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
