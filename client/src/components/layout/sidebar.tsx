import { Link, useLocation } from "wouter";
import {
  Tv,
  Film,
  Image,
  PlayCircle,
  ListChecks,
  BarChart3,
  User,
  Settings as SettingsIcon,
  Play,
  TestTube
} from "lucide-react";

const navigation = [
  // { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Channels', href: '/channels', icon: Tv },
  { name: 'Video Templates', href: '/video-templates', icon: Film },
  { name: 'Videos', href: '/videos', icon: Play },
  { name: 'Thumbnails', href: '/thumbnails', icon: Image },
  { name: 'Hooks', href: '/hooks', icon: PlayCircle },
  { name: 'QA Dashboard', href: '/qa', icon: TestTube },
  { name: 'Logs & Debug', href: '/logs', icon: ListChecks },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-sidebar-background border-r border-sidebar-border shadow-sm">
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="flex items-center px-6 py-4 border-b border-sidebar-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src="/favicon.png" alt="Logo" />
            </div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">VideoAI Pro</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={
                  isActive
                    ? "nav-link-active"
                    : "nav-link-inactive"
                }
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground">Admin User</p>
              <p className="text-xs text-muted-foreground">admin@example.com</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
