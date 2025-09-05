export async function askAI(prompt: string, mode: 'chat' | 'hint' = 'chat') {
  const shortPrompt =
    mode === 'hint'
      ? `Sadece 1 hamle önerisi yap ve 2 cümleden fazla yazma.\n${prompt}`
      : prompt;

  const res = await fetch('/api/ask-ai', {
    method: 'POST',
    body: JSON.stringify({ prompt: shortPrompt }),
  });

  const data = await res.json();
  return data.result || '[Yanıt alınamadı]';
}