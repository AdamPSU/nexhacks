import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * Uses Gemini 3 Flash (via OpenRouter) to analyze the current whiteboard image
 * and return a natural language description / analysis of the workspace.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { image, focus } = await req.json();

    if (!image) {
      voiceLogger.warn('No image provided to analyze-workspace route');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 },
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      voiceLogger.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 },
      );
    }

    const promptPath = path.join(process.cwd(), 'prompts', 'context_manager.txt');
    const systemPrompt = fs.readFileSync(promptPath, 'utf8');

    const userPrompt = focus
      ? `Here is a snapshot of the user canvas. Focus on: ${focus}`
      : 'Here is a snapshot of the user canvas. Describe what they are working on and how you could help.';

    voiceLogger.info('Calling Gemini 3 Flash for workspace analysis');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas - Voice Workspace Analysis',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      voiceLogger.error(
        {
          status: response.status,
          error: errorData,
        },
        'OpenRouter Gemini 2.5 Flash API error',
      );
      return NextResponse.json(
        { error: 'Workspace analysis failed' },
        { status: 500 },
      );
    }

    const data = await response.json();
    const analysis =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.message?.text ??
      '';

    const duration = Date.now() - startTime;
    voiceLogger.info(
      {
        duration,
        textLength: typeof analysis === 'string' ? analysis.length : 0,
        tokensUsed: data.usage?.total_tokens,
      },
      'Workspace analysis completed successfully',
    );

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    voiceLogger.error(
      {
        duration,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      'Error analyzing workspace',
    );

    return NextResponse.json(
      { error: 'Error analyzing workspace' },
      { status: 500 },
    );
  }
}









