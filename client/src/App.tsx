import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Channels from "@/pages/channels";
import VideoTemplates from "@/pages/video-templates";
import Thumbnails from "@/pages/thumbnails";
import Hooks from "@/pages/hooks";
import Logs from "@/pages/logs";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";
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
          <Route path="/thumbnails" component={Thumbnails} />
          <Route path="/hooks" component={Hooks} />
          <Route path="/logs" component={Logs} />
          <Route path="/analytics" component={Analytics} />
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
