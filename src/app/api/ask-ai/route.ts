import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    console.log("Gelen prompt (GROQ):", prompt);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Diğer seçenek: llama3-70b-8192 veya mixtral-8x7b-32768
        messages: [
          {
            role: 'system',
            content: 'You are a helpful chess coach assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("GROQ API HATASI:", data);
      return NextResponse.json({ error: data }, { status: 500 });
    }

    const result = data.choices?.[0]?.message?.content || '[GROQ cevap veremedi]';
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("❌ GROQ Backend HATASI:", err);
    return NextResponse.json({ error: err?.message || 'GROQ hata' }, { status: 500 });
  }
}
