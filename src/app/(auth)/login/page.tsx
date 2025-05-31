import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/70 via-accent/60 to-secondary/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-2xl">
        {/* The icon and title are now part of LoginForm */}
        <LoginForm />
      </div>
       <footer className="mt-8 text-center text-sm text-background/80">
        © {new Date().getFullYear()} DairyFlow. All rights reserved.
      </footer>
    </div>
  );
}
