import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * Creates an ephemeral Realtime session with OpenAI and returns the client secret
 * that the browser can use to establish a WebRTC connection.
 */
export async function POST(_req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    voiceLogger.error('OPENAI_API_KEY not configured for Realtime voice token route');
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const startTime = Date.now();

    const promptPath = path.join(process.cwd(), 'prompts', 'voice_assistant.txt');
    const voiceInstructions = fs.readFileSync(promptPath, 'utf8');

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        instructions: voiceInstructions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      voiceLogger.error(
        {
          status: response.status,
          error: errorText?.slice(0, 1000),
        },
        'Failed to create Realtime session',
      );
      return NextResponse.json(
        { error: 'Failed to create Realtime session' },
        { status: 500 },
      );
    }

    const data = await response.json();

    // The Realtime API currently returns a client_secret object; prefer .value if present.
    const clientSecret =
      data?.client_secret?.value ??
      data?.client_secret ??
      data?.client_secret_key ??
      null;

    if (!clientSecret || typeof clientSecret !== 'string') {
      voiceLogger.error(
        {
          rawResponseSnippet: JSON.stringify(data).slice(0, 1000),
        },
        'Realtime session created but client secret missing or invalid',
      );
      return NextResponse.json(
        { error: 'Realtime session created but client secret missing' },
        { status: 500 },
      );
    }

    const duration = Date.now() - startTime;
    voiceLogger.info(
      { duration },
      'Realtime session token created successfully',
    );

    return NextResponse.json({ client_secret: clientSecret });
  } catch (error) {
    voiceLogger.error(
      {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      'Error creating Realtime session token',
    );

    return NextResponse.json(
      { error: 'Error creating Realtime session token' },
      { status: 500 },
    );
  }
}









