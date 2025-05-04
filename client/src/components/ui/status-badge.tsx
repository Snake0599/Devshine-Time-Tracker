import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let label = status;
  
  switch (status.toLowerCase()) {
    case "active":
      variant = "default";
      className = cn("bg-green-100 text-green-800 hover:bg-green-100", className);
      break;
    case "inactive":
      variant = "outline";
      className = cn("bg-red-100 text-red-800 hover:bg-red-100", className);
      break;
    case "completed":
      variant = "default";
      className = cn("bg-green-100 text-green-800 hover:bg-green-100", className);
      break;
    case "pending":
    case "in progress":
      variant = "secondary";
      className = cn("bg-yellow-100 text-yellow-800 hover:bg-yellow-100", className);
      label = "Active";
      break;
    case "off day":
      variant = "outline";
      className = cn("bg-gray-100 text-gray-800 hover:bg-gray-100", className);
      label = "Off Day";
      break;
    default:
      break;
  }

  return (
    <Badge variant={variant} className={className} {...props}>
      {label}
    </Badge>
  );
}
