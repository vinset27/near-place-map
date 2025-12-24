import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import List from "@/pages/List";
import Details from "@/pages/Details";
import Business from "@/pages/Business";
import Profile from "@/pages/Profile";

import Navigation from "@/pages/Navigation";
import AdminApplications from "@/pages/AdminApplications";
import Entry from "@/pages/Entry";
import Welcome from "@/pages/Welcome";
import Permissions from "@/pages/Permissions";
import Ready from "@/pages/Ready";
import React, { useEffect } from "react";
import { RequireOnboarding } from "@/components/RequireOnboarding";
import { startTimeThemeSync } from "@/lib/timeTheme";

function Protected({ children }: { children: React.ReactNode }) {
  return <RequireOnboarding>{children}</RequireOnboarding>;
}

function Router() {
  return (
    <Switch>
      {/* Entry + 3-step intro */}
      <Route path="/" component={Entry} />
      <Route path="/welcome" component={Welcome} />
      <Route path="/permissions" component={Permissions} />
      <Route path="/ready" component={Ready} />

      {/* App */}
      <Route path="/app" component={() => <Protected><Home /></Protected>} />
      <Route path="/list" component={() => <Protected><List /></Protected>} />
      <Route path="/details/:id" component={() => <Protected><Details /></Protected>} />
      <Route path="/navigation" component={() => <Protected><Navigation /></Protected>} />
      <Route path="/business" component={() => <Protected><Business /></Protected>} />
      <Route path="/profile" component={() => <Protected><Profile /></Protected>} />
      <Route path="/admin/applications" component={() => <Protected><AdminApplications /></Protected>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => startTimeThemeSync(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
