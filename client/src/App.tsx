import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Channels from "@/pages/channels";
import VideoTemplates from "@/pages/video-templates";
import Videos from "@/pages/videos";
import Thumbnails from "@/pages/thumbnails";
import Hooks from "@/pages/hooks";
import QA from "@/pages/qa";
import Logs from "@/pages/logs";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Switch>
          {/* <Route path="/" component={Dashboard} /> */}
          <Route path="/" component={() => <Redirect to="/channels" />} />
          <Route path="/channels" component={Channels} />
          <Route path="/video-templates" component={VideoTemplates} />
          <Route path="/videos" component={Videos} />
          <Route path="/thumbnails" component={Thumbnails} />
          <Route path="/hooks" component={Hooks} />
          <Route path="/qa" component={QA} />
          <Route path="/logs" component={Logs} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
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
