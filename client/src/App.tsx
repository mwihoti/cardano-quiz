import { Switch, Route } from "wouter";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { gameSocket } from "@/lib/websocket";

import Home from "@/pages/Home";
import Host from "@/pages/Host";
import HostDashboard from "@/pages/HostDashboard";
import Leader from "@/pages/Leader";
import Room from "@/pages/Room";
import NotFound from "@/pages/not-found";

export default function App() {
  useEffect(() => {
    gameSocket.connect();
    return () => gameSocket.disconnect();
  }, []);

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/host" component={Host} />
        <Route path="/host/:gameId" component={HostDashboard} />
        <Route path="/leader" component={Leader} />
        <Route path="/room/:roomCode" component={Room} />
        <Route component={NotFound} />
      </Switch>
      <Toaster theme="dark" richColors position="top-center" />
    </>
  );
}
