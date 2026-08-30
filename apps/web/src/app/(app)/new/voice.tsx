'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Progressive-enhancement mic button: if the browser has the Web Speech API, it dictates
 * into the named textarea; otherwise it renders nothing, so the typed field is unaffected.
 */
export function VoiceDictateButton({ targetId }: { targetId: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      const target = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (!target) return;
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      target.value = (target.value ? target.value.trimEnd() + ' ' : '') + text.trim();
      target.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => rec.stop();
  }, [targetId]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const rec = recognitionRef.current;
        if (!rec) return;
        if (listening) {
          rec.stop();
          setListening(false);
        } else {
          rec.start();
          setListening(true);
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
        listening ? 'border-critical bg-critical-soft text-critical' : 'border-line text-ink-soft hover:bg-surface-sunken'
      }`}
      aria-pressed={listening}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      {listening ? 'Listening… tap to stop' : 'Dictate'}
    </button>
  );
}
