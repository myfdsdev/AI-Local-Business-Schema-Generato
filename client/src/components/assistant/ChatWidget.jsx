import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send, X } from 'lucide-react';

import { assistantApi } from '@/api/assistant';
import { toApiError } from '@/api/client';
import { LottieAnimation } from '@/components/common/LottieAnimation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GREETING = {
  role: 'assistant',
  content:
    "Hi! I can help with schema markup, local SEO, and using this app.\n\nTry asking:\n- Which schema type fits my business?\n- How do I fix a validation error?\n- What does the website scan do?",
};

// Remembers that the user has already discovered the assistant, so the initial
// nudge badge doesn't reappear on every page load forever.
const SEEN_KEY = 'localschema-assistant-seen';

const hasSeenAssistant = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // private mode — just show the nudge
  }
};

/**
 * Floating assistant. Conversation lives in component state only — it is not
 * persisted, so closing the widget starts fresh.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  // Unread count drives the red badge. Starts at 1 for the unseen greeting.
  const [unread, setUnread] = useState(() => (hasSeenAssistant() ? 0 : 1));
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Mirrors `open` so async reply handlers read the current value without
  // being re-created on every toggle.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // A reply can land after the user has closed the panel, so flag it as unread.
  const receive = (message) => {
    setMessages((current) => [...current, message]);
    if (!openRef.current) setUnread((count) => count + 1);
  };

  const mutation = useMutation({
    mutationFn: (history) =>
      // The greeting is local-only; don't send it as real conversation history.
      assistantApi.chat(history.filter((message) => message !== GREETING)),
    onSuccess: (data) => receive({ role: 'assistant', content: data.reply }),
    onError: (error) => receive({ role: 'assistant', content: toApiError(error).message, isError: true }),
  });

  const toggle = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        setUnread(0);
        try {
          localStorage.setItem(SEEN_KEY, '1');
        } catch {
          /* private mode — nothing to persist */
        }
      }
      return next;
    });
  };

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, mutation.isPending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const send = () => {
    const text = input.trim();
    if (!text || mutation.isPending) return;

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    mutation.mutate(next);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[30rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <LottieAnimation src="/animations/chatbot.json" className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">Assistant</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Schema &amp; local SEO help</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : message.isError
                        ? 'rounded-bl-sm bg-destructive/10 text-destructive'
                        : 'rounded-bl-sm bg-muted text-foreground',
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {mutation.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about schema or local SEO…"
                className="max-h-24 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="icon" onClick={send} disabled={!input.trim() || mutation.isPending} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              AI answers can be wrong — check anything important.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={
          open
            ? 'Close assistant'
            : unread > 0
              ? `Open assistant, ${unread} unread message${unread > 1 ? 's' : ''}`
              : 'Open assistant'
        }
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <LottieAnimation src="/animations/chatbot.json" className="h-11 w-11" />
        )}

        {/* Unread badge — only while the panel is closed. */}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5" aria-hidden>
            {/* Pulse ring to catch the eye, sitting behind the solid dot. */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          </span>
        )}
      </button>
    </>
  );
}

export default ChatWidget;
