import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

/**
 * Five-question welcome questionnaire shown after login until it's completed
 * (spec section 4, step 2). Each question is single-select; answers map onto
 * fields the onboarding endpoint stores on the user.
 *
 * `key` is the field name sent to the API. Keep option values in sync with the
 * server enums in constants.js.
 */
const QUESTIONS = [
  {
    key: 'accountType',
    title: 'What best describes you?',
    subtitle: 'This tailors LocalSchema AI to how you work.',
    options: [
      { value: 'local_business', label: 'Local business owner' },
      { value: 'freelancer', label: 'Freelancer' },
      { value: 'seo_agency', label: 'SEO agency' },
      { value: 'web_developer', label: 'Web developer' },
      { value: 'marketing_consultant', label: 'Marketing consultant' },
    ],
  },
  {
    key: 'businessCategory',
    title: 'What type of business are you working on?',
    subtitle: "Pick the closest match — you can set an exact type per project later.",
    options: [
      { value: 'food', label: 'Restaurant, cafe or food service' },
      { value: 'health', label: 'Health or medical' },
      { value: 'home_services', label: 'Home services or trades' },
      { value: 'beauty', label: 'Beauty and wellness' },
      { value: 'retail', label: 'Retail or store' },
      { value: 'professional', label: 'Professional services' },
      { value: 'lodging', label: 'Hotel or lodging' },
      { value: 'other', label: 'Something else' },
    ],
  },
  {
    key: 'goal',
    title: 'What do you want to do first?',
    subtitle: "We'll point you at the right place to start.",
    options: [
      { value: 'generate_schema', label: 'Generate schema markup' },
      { value: 'audit_schema', label: 'Audit existing schema' },
      { value: 'manage_locations', label: 'Manage multiple locations' },
      { value: 'client_reports', label: 'Create client SEO reports' },
      { value: 'monitor_errors', label: 'Monitor schema errors' },
    ],
  },
  {
    key: 'locationCount',
    title: 'How many locations do you manage?',
    subtitle: 'This helps us set up single- or multi-location projects.',
    options: [
      { value: 'single', label: 'Just one' },
      { value: '2_5', label: '2 to 5' },
      { value: '6_20', label: '6 to 20' },
      { value: '20_plus', label: 'More than 20' },
    ],
  },
  {
    key: 'experienceLevel',
    title: 'How familiar are you with schema markup?',
    subtitle: "There are no wrong answers — we'll match the guidance to you.",
    options: [
      { value: 'new', label: "I'm new to structured data" },
      { value: 'some', label: 'I have some experience' },
      { value: 'advanced', label: 'I work with it regularly' },
    ],
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, patchUser } = useAuth();

  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [answers, setAnswers] = useState(() => ({
    accountType: user?.accountType ?? null,
    businessCategory: null,
    goal: null,
    locationCount: null,
    experienceLevel: null,
  }));
  const [submitting, setSubmitting] = useState(false);

  const current = QUESTIONS[step];
  const selected = answers[current.key];
  const isLastStep = step === QUESTIONS.length - 1;
  const answeredCount = useMemo(
    () => QUESTIONS.filter((question) => answers[question.key]).length,
    [answers],
  );

  const choose = (value) => setAnswers((prev) => ({ ...prev, [current.key]: value }));

  const onlyAnswered = (extra = {}) => {
    const payload = { ...extra };
    for (const [key, value] of Object.entries(answers)) {
      if (value) payload[key] = value;
    }
    if (companyName.trim()) payload.companyName = companyName.trim();
    return payload;
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      const updated = await authApi.completeOnboarding(onlyAnswered());
      patchUser(updated);
      toast.success("You're all set. Welcome to LocalSchema AI.");
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    setSubmitting(true);
    try {
      // Marks onboarding complete (with whatever was answered) so it stops
      // showing on every login, without forcing the remaining questions.
      const updated = await authApi.completeOnboarding(onlyAnswered({ skipped: true }));
      patchUser(updated);
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Logo className="mb-8" />

      <div className="w-full max-w-lg">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {step + 1} of {QUESTIONS.length}
          </span>
          <span>{answeredCount} answered</span>
        </div>

        <div className="mb-6 flex items-center gap-1.5" aria-hidden>
          {QUESTIONS.map((question, index) => (
            <div
              key={question.key}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index < step ? 'bg-primary' : index === step ? 'bg-primary/60' : 'bg-muted',
              )}
            />
          ))}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
        {current.subtitle && <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>}

        {/* Business/agency name lives on the first step, alongside account type. */}
        {step === 0 && (
          <div className="mt-6 space-y-1.5">
            <Label htmlFor="companyName">Business or agency name</Label>
            <Input
              id="companyName"
              value={companyName}
              disabled={submitting}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Bella Vista Trattoria"
              autoComplete="organization"
            />
            <p className="text-xs text-muted-foreground">Optional — you can add this later.</p>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {current.options.map((option) => {
            const active = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={active}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40 hover:bg-accent',
                )}
              >
                {option.label}
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={skip} disabled={submitting}>
            Skip for now
          </Button>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((value) => value - 1)} disabled={submitting}>
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={finish} disabled={!selected || submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Finish
              </Button>
            ) : (
              <Button onClick={() => setStep((value) => value + 1)} disabled={!selected}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
