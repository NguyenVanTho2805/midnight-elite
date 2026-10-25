// Đọc to bằng giọng của trình duyệt (Web Speech API) — miễn phí, không tốn quota, dùng cho chép chính tả và phát âm từ.
"use client";

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
  const en = voices.filter(v => v.lang?.toLowerCase().startsWith("en"));
  cachedVoice = en.find(v => /en-gb/i.test(v.lang) && /natural|google|neural/i.test(v.name)) ?? en.find(v => /natural|google|neural/i.test(v.name)) ?? en.find(v => /en-gb/i.test(v.lang)) ?? en[0] ?? null;
  return cachedVoice;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, rate = 0.9): Promise<void> {
  return new Promise(resolve => {
    if (!canSpeak()) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-GB";
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() { if (canSpeak()) window.speechSynthesis.cancel(); }

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = undefined; };
}
