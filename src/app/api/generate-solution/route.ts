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

    if (!imageFile) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    let textContent = "";
    let shouldDraw = true;

    // --- STAGE 1: INTENT CLASSIFICATION (Only for Chat) ---
    if (source === 'chat' && prompt) {
      const chatDecisionPrompt = fs.readFileSync(path.join(process.cwd(), 'prompts', 'chat_decision.txt'), 'utf8');
      
      try {
        const result = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{
            role: "user",
            parts: [{ text: `${chatDecisionPrompt}\n\nUSER INPUT: "${prompt}"` }]
          }],
          config: {
            responseMimeType: "application/json"
          }
        });
        
        const intentData = JSON.parse(result.text || "{}");
        textContent = intentData.message || "";
        shouldDraw = intentData.intent === "DRAW";
        
        if (!shouldDraw) {
          return NextResponse.json({
            success: true,
            imageUrl: null,
            textContent: textContent,
          });
        }
      } catch (e) {
        solutionLogger.error({ requestId, error: String(e) }, 'Intent classification failed, defaulting to DRAW');
        shouldDraw = true; 
      }
    }

    // --- STAGE 2: ARTIST DELEGATION ---
    const artistPrompt = fs.readFileSync(path.join(process.cwd(), 'prompts', 'artist.txt'), 'utf8');
    const fullPrompt = prompt 
      ? `${artistPrompt}\n\nUSER INPUT: "${prompt}"`
      : artistPrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: fullPrompt },
            { inlineData: { data: base64Data, mimeType } }
          ],
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const finalContent = response.text || textContent;
    
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
    solutionLogger.error({ requestId, error: String(error) }, 'Generation error');
    return NextResponse.json({ error: 'Failed to generate solution' }, { status: 500 });
  }
}
