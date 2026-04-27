export interface ParsedClass {
  subject: string;
  day: number;
  period: number;
}

export interface ParseResponse {
  ok: boolean;
  classes?: ParsedClass[];
  error?: string;
}

export async function parseTimetableImage(
  apiKey: string,
  imageBase64: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
): Promise<ParseResponse> {
  const res = await fetch('/api/timetable/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, imageBase64, mediaType }),
  });
  return (await res.json()) as ParseResponse;
}

export function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('読み込み失敗'));
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(',');
      resolve({ data: base64, mediaType: file.type || 'image/png' });
    };
    reader.readAsDataURL(file);
  });
}
