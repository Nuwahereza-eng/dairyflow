import { LoginForm } from '@/components/auth/LoginForm';
import { MilkIcon } from '@/components/icons/MilkIcon';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/70 via-accent/60 to-secondary/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <MilkIcon className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-center text-foreground">DairyFlow</h1>
          <p className="text-muted-foreground text-center mt-1">MCC & Dairy Farmer Management</p>
        </div>
        <LoginForm />
      </div>
       <footer className="mt-8 text-center text-sm text-background/80">
        © {new Date().getFullYear()} DairyFlow. All rights reserved.
      </footer>
    </div>
  );
}
