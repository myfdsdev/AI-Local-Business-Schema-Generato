import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild className="mt-6">
        <Link to={isAuthenticated ? '/app/dashboard' : '/'}>Go home</Link>
      </Button>
    </div>
  );
}
