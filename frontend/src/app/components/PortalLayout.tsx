import { ReactNode, useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { Bell, ChevronLeft, ChevronRight, GraduationCap, LogOut, Menu, Settings, User } from 'lucide-react';
import { cn } from './ui/utils';

interface PortalLayoutProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
  navigation: {
    name: string;
    icon: ReactNode;
    active?: boolean;
    onClick: () => void;
  }[];
  children: ReactNode;
}

export default function PortalLayout({ userName, userRole, onLogout, navigation, children }: PortalLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex items-center gap-2 text-indigo-600">
              <GraduationCap className="size-8" />
              <span className="text-xl hidden sm:inline">ConnectEd</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              <Badge className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 bg-red-500">
                3
              </Badge>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-indigo-600 text-white text-sm">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm">{userName}</div>
                    <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="size-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="size-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="size-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 z-20",
            sidebarCollapsed ? "w-16" : "w-64",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="p-4 space-y-2">
            {navigation.map((item, index) => (
              <Button
                key={index}
                variant={item.active ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  item.active && "bg-indigo-600 hover:bg-indigo-700",
                  sidebarCollapsed && "justify-center px-2"
                )}
                onClick={item.onClick}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Button>
            ))}
          </nav>

          {/* Logout Button in Sidebar */}
          <div className="absolute bottom-16 left-0 right-0 p-4 border-t">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50",
                sidebarCollapsed && "justify-center px-2"
              )}
              onClick={onLogout}
            >
              <LogOut className="size-5" />
              {!sidebarCollapsed && <span>Logout</span>}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 right-4 hidden lg:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-5" />
            ) : (
              <ChevronLeft className="size-5" />
            )}
          </Button>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}