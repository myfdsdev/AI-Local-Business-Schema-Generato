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

/**
 * Floating assistant. Conversation lives in component state only — it is not
 * persisted, so closing the widget starts fresh.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (history) =>
      // The greeting is local-only; don't send it as real conversation history.
      assistantApi.chat(history.filter((message) => message !== GREETING)),
    onSuccess: (data) => setMessages((current) => [...current, { role: 'assistant', content: data.reply }]),
    onError: (error) =>
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: toApiError(error).message, isError: true },
      ]),
  });

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
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105',
          open ? 'bg-primary text-primary-foreground' : 'bg-primary',
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <LottieAnimation src="/animations/chatbot.json" className="h-11 w-11" />
        )}
      </button>
    </>
  );
}

export default ChatWidget;
