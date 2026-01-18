import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { solutionLogger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const prompt = formData.get('prompt') as string | null;
    const source = formData.get('source') as string | null;

    // Collect reference images
    const referenceImages: { data: string; mimeType: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('reference_') && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        referenceImages.push({
          data: buffer.toString('base64'),
          mimeType: value.type || 'image/jpeg'
        });
      }
    }

    if (!imageFile) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    let textContent = "";
    let shouldDraw = true;

    // --- STAGE 1: INTENT CLASSIFICATION (Only for Chat) ---
    if (source === 'chat' && prompt) {
      const classifierPrompt = fs.readFileSync(path.join(process.cwd(), 'prompts', 'classifier.txt'), 'utf8');
      
      const classifierParts: any[] = [{ text: `${classifierPrompt}\n\nUSER INPUT: "${prompt}"` }];
      
      // Include reference images in classification for better context
      referenceImages.forEach(img => {
        classifierParts.push({ inlineData: img });
      });

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: classifierParts
        }],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const intentData = JSON.parse(result.text || "{}");
      textContent = intentData.message || "";
      shouldDraw = intentData.intent?.toLowerCase() === "draw";
      
      if (!shouldDraw) {
        return NextResponse.json({
          success: true,
          imageUrl: null,
          textContent: textContent,
        });
      }
    }

    // --- STAGE 2: ARTIST DELEGATION ---
    const artistPrompt = fs.readFileSync(path.join(process.cwd(), 'prompts', 'artist.txt'), 'utf8');
    const fullPrompt = prompt 
      ? `${artistPrompt}\n\nUSER INPUT: "${prompt}"`
      : artistPrompt;

    const artistParts: any[] = [
      { text: fullPrompt },
      { inlineData: { data: base64Data, mimeType } } // Canvas snapshot
    ];

    // Add reference images to the artist's context
    referenceImages.forEach(img => {
      artistParts.push({ inlineData: img });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          role: 'user',
          parts: artistParts,
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // CRITICAL: We use textContent from Stage 1 (the classifier) if it exists,
    // ensuring the user sees the conversational response immediately.
    const finalContent = textContent || response.text;
    
    let imageUrl = null;
    const candidates = response.candidates;
    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    solutionLogger.info({ requestId, hasImage: !!imageUrl }, 'Solution generated via native SDK');

    return NextResponse.json({
      success: !!imageUrl,
      imageUrl: imageUrl || null,
      textContent: finalContent || '',
      reason: imageUrl ? undefined : 'Model did not return an image completion.',
    });
  } catch (error) {
    solutionLogger.error({ requestId, err: error }, 'Generation error');
    return NextResponse.json({ error: 'Failed to generate solution' }, { status: 500 });
  }
}
