import { useAuth } from "@/hooks/use-auth";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";

export function SiteHeader() {
  const { user, logoutMutation } = useAuth();
  const isMobile = useMobile();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <SidebarNav className="border-0" />
              </SheetContent>
            </Sheet>
          )}
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="ml-2 text-2xl font-semibold text-gray-900">TimeTrack</h1>
        </div>
        <div className="flex items-center">
          {user && (
            <>
              <span className="text-sm text-gray-600 mr-4">Admin</span>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-sm text-gray-600 hover:text-primary flex items-center"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm11 0H6v14h8V3z" clipRule="evenodd" />
                  <path d="M13 7a1 1 0 100-2h-3a1 1 0 000 2h3zm-3 4a1 1 0 100-2h-3a1 1 0 000 2h3zm0 4a1 1 0 100-2h-3a1 1 0 000 2h3z" />
                </svg>
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
