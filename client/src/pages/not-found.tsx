import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, nav] = useLocation();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-black text-white mb-2">Page Not Found</h1>
      <p className="text-muted-foreground text-sm mb-6">The room or page you're looking for doesn't exist.</p>
      <Button onClick={() => nav("/")}>Go Home</Button>
    </div>
  );
}
