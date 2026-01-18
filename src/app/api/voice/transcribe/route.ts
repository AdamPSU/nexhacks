import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';

/**
 * Proxy route for Wispr Flow AI transcription.
 * Accepts a WAV file in FormData.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!process.env.WISPR_FLOW_API_KEY) {
      voiceLogger.error('WISPR_FLOW_API_KEY not configured');
      return NextResponse.json({ error: 'Wispr Flow API key not configured' }, { status: 500 });
    }

    // Convert blob to base64 as Wispr Flow REST API expects base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const response = await fetch('https://api.wisprflow.ai/api', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WISPR_FLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: base64Audio,
        // Optional context or language can be added here
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      voiceLogger.error({ status: response.status, error: errorText }, 'Wispr Flow API error');
      return NextResponse.json({ error: 'Transcription failed' }, { status: response.status });
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    voiceLogger.info({ duration, transcriptLength: data.text?.length }, 'Transcription successful');

    return NextResponse.json({ text: data.text });
  } catch (error) {
    voiceLogger.error({ error }, 'Error in transcription proxy');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

