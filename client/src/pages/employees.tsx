import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmployeeForm } from "@/components/ui/employee-form";
import { useMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Employee } from "@shared/schema";
import { format } from "date-fns";
import { Edit, Trash2, Plus } from "lucide-react";

export default function Employees() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Delete employee mutation
  const deactivateMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      await apiRequest("PATCH", `/api/employees/${employeeId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Employee deactivated",
        description: "The employee has been successfully deactivated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle employee deactivate
  const handleDeactivateEmployee = (employeeId: number) => {
    if (window.confirm("Are you sure you want to deactivate this employee? Historical data will be preserved.")) {
      deactivateMutation.mutate(employeeId);
    }
  };

  // Handle edit employee
  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsAddDialogOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setSelectedEmployee(null);
    setIsAddDialogOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      
      <div className="flex flex-1">
        {/* Sidebar (hidden on mobile) */}
        {!isMobile && <SidebarNav />}
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Employees</h2>
                <p className="mt-1 text-sm text-gray-600">Manage employees and their information</p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            {/* Employee List */}
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latest Check In</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          Loading employees...
                        </TableCell>
                      </TableRow>
                    ) : employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          No employees found. Add some employees to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            EMP-{String(employee.id).padStart(3, "0")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-gray-600 font-medium">
                                    {employee.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                <div className="text-sm text-gray-500">{employee.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {employee.position}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={employee.status} />
                          </TableCell>
                          <TableCell>
                            {employee.lastCheckIn 
                              ? format(new Date(employee.lastCheckIn), "MMM dd, yyyy hh:mm a")
                              : "No check-ins yet"
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-indigo-600 hover:text-indigo-900"
                                onClick={() => handleEditEmployee(employee)}
                              >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleDeactivateEmployee(employee.id)}
                                disabled={employee.status === "inactive"}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Deactivate</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm 
            employee={selectedEmployee || undefined} 
            onSuccess={handleFormClose} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
