import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimeEntry, Employee } from "@shared/schema";
import { useState, useEffect } from "react";
import { formatTimeForInput, calculateTotalHours } from "@shared/utils";
import { formatHoursToHhMm } from "@shared/utils";
// Form schema
const timeEntrySchema = z.object({
  employeeId: z.coerce.number().min(1, "Employee selection is required"),
  date: z.string().min(1, "Date is required"),
  checkInTime: z.string().min(1, "Check-in time is required"),
  checkOutTime: z.string().optional(),
  breakMinutes: z.coerce.number().min(0, "Break minutes must be 0 or greater").default(0),
});

type TimeEntryFormValues = z.infer<typeof timeEntrySchema>;

interface TimeEntryFormProps {
  timeEntry?: TimeEntry;
  onSuccess?: () => void;
}

export function TimeEntryForm({ timeEntry, onSuccess }: TimeEntryFormProps) {
  const { toast } = useToast();
  const [totalHours, setTotalHours] = useState<string | null>(null);
  
  // Fetch employees for the dropdown
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Form initialization
  const form = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      employeeId: timeEntry?.employeeId || 0,
      date: timeEntry?.date || new Date().toISOString().split("T")[0],
      checkInTime: timeEntry?.checkInTime ? formatTimeForInput(timeEntry.checkInTime) : "",
      checkOutTime: timeEntry?.checkOutTime ? formatTimeForInput(timeEntry.checkOutTime) : "",
      breakMinutes: timeEntry?.breakMinutes || 0,
    },
  });

  // Recalculate total hours when form values change
  useEffect(() => {
    const checkInTime = form.watch("checkInTime");
    const checkOutTime = form.watch("checkOutTime");
    const breakMinutes = form.watch("breakMinutes");
    
    if (checkInTime && checkOutTime) {
      const hours = calculateTotalHours(checkInTime, checkOutTime, breakMinutes || 0);
      setTotalHours(hours !== null ? hours.toFixed(2) : null);
    } else {
      setTotalHours(null);
    }
  }, [form.watch("checkInTime"), form.watch("checkOutTime"), form.watch("breakMinutes")]);

  // Create or update mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // We'll use the already preprocessed data from onSubmit function
      // The data should now have proper type conversion
      
      const endpoint = timeEntry 
        ? `/api/time-entries/${timeEntry.id}` 
        : "/api/time-entries";
      const method = timeEntry ? "PATCH" : "POST";
      
      console.log('Making API request with data:', data);
      const res = await apiRequest(method, endpoint, data);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error(errorText);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: timeEntry ? "Time entry updated" : "Time entry created",
        description: timeEntry 
          ? "The time entry has been successfully updated." 
          : "A new time entry has been successfully created.",
      });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: TimeEntryFormValues) {
    console.log('Form data before submission:', data);
    
    // Explicitly convert the form data to the right format before submission
    const formattedData = {
      ...data,
      employeeId: Number(data.employeeId),
      breakMinutes: Number(data.breakMinutes),
      // Let's manually format the date as an ISO string that Postgres will accept
      date: new Date(data.date).toISOString(),
    };

    console.log('Formatted data for submission:', formattedData);
    mutation.mutate(formattedData);
  }

  const isSubmitting = mutation.isPending;
  const title = timeEntry ? "Edit Time Entry" : "Quick Add Time Entry";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        disabled={isSubmitting}
                        className="custom-date-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="checkInTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check In</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          disabled={isSubmitting} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkOutTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check Out</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          value={field.value || ""} 
                          disabled={isSubmitting} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="breakMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={(e) => {
                          const value = e.target.value === "" ? "0" : e.target.value;
                          field.onChange(value);
                        }}
                        disabled={isSubmitting} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2 flex items-end">
                {totalHours !== null && (
                  <div className="text-sm text-gray-500">
                    Total hours: <span className="font-medium">{formatHoursToHhMm(totalHours)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {isSubmitting 
                    ? (timeEntry ? "Saving..." : "Adding...") 
                    : (timeEntry ? "Save Changes" : "Add Time Entry")
                  }
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
