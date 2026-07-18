import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

const ACCOUNT_TYPES = [
  { value: 'local_business', label: 'Local business owner' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'seo_agency', label: 'SEO agency' },
  { value: 'web_developer', label: 'Web developer' },
  { value: 'marketing_consultant', label: 'Marketing consultant' },
];

const GOALS = [
  { value: 'generate_schema', label: 'Generate schema markup' },
  { value: 'audit_schema', label: 'Audit existing schema' },
  { value: 'manage_locations', label: 'Manage multiple locations' },
  { value: 'client_reports', label: 'Create client SEO reports' },
  { value: 'monitor_errors', label: 'Monitor schema errors' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, patchUser } = useAuth();

  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState(user?.accountType ?? null);
  const [goal, setGoal] = useState(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      const updated = await authApi.completeOnboarding({
        accountType: accountType ?? undefined,
        goal: goal ?? undefined,
      });
      patchUser(updated);
      navigate('/app/projects/new', { replace: true });
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      title: 'What best describes you?',
      options: ACCOUNT_TYPES,
      value: accountType,
      onSelect: setAccountType,
    },
    {
      title: 'What do you want to do first?',
      options: GOALS,
      value: goal,
      onSelect: setGoal,
    },
  ];

  const current = steps[step];
  const canContinue = Boolean(current.value);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us tailor LocalSchema AI to how you work. You can change it later.
        </p>

        <div className="mt-6 grid gap-3">
          {current.options.map((option) => {
            const selected = current.value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => current.onSelect(option.value)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40 hover:bg-accent',
                )}
              >
                {option.label}
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/app/dashboard', { replace: true })}>
            Skip for now
          </Button>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((value) => value + 1)} disabled={!canContinue}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!canContinue || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Finish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
