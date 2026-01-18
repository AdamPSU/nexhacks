import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';

/**
 * Proxy route for OpenAI Whisper transcription.
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

    if (!process.env.OPENAI_API_KEY) {
      voiceLogger.error('OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // OpenAI Whisper API expects a file, usually as multipart/form-data
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.wav');
    whisperFormData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      voiceLogger.error({ status: response.status, error: errorText }, 'OpenAI Whisper API error');
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

