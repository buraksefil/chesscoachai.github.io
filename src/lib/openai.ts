export async function askAI(prompt: string): Promise<string> {
  const res = await fetch('/api/ask-ai', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data.result || '[AI cevap veremedi]';
}
