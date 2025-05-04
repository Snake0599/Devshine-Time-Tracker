import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  HomeIcon, 
  ClockIcon, 
  UsersIcon, 
  FileTextIcon 
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: <HomeIcon className="h-5 w-5 mr-2" />,
  },
  {
    title: "Time Entries",
    href: "/time-entries",
    icon: <ClockIcon className="h-5 w-5 mr-2" />,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: <UsersIcon className="h-5 w-5 mr-2" />,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: <FileTextIcon className="h-5 w-5 mr-2" />,
  },
];

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarNav({ className, ...props }: SidebarNavProps) {
  const [location, navigate] = useLocation();

  return (
    <div className={cn("bg-white shadow-sm w-64 min-h-screen border-r", className)} {...props}>
      <div className="p-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.href);
              }}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                location === item.href
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {item.icon}
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
