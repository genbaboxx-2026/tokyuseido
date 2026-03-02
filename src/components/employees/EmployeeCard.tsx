import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { EmployeeWithRelations } from "@/types/employee";
import { EmploymentTypeLabels } from "@/types/employee";

interface EmployeeCardProps {
  employee: EmployeeWithRelations;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const fullName = `${employee.lastName} ${employee.firstName}`;
  const initials = `${employee.lastName.charAt(0)}${employee.firstName.charAt(0)}`;

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-";
    return `${salary.toLocaleString()}円`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Link
            href={`/employees/${employee.id}`}
            className="hover:underline"
          >
            <CardTitle className="text-lg">{fullName}</CardTitle>
          </Link>
          <p className="text-sm text-muted-foreground font-mono">
            {employee.employeeCode}
          </p>
        </div>
        <Badge variant="outline">
          {EmploymentTypeLabels[employee.employmentType]}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">部署</dt>
            <dd className="font-medium">{employee.department?.name || "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">職種</dt>
            <dd className="font-medium">{employee.jobType?.name || "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">等級</dt>
            <dd className="font-medium">
              {employee.grade ? (
                <Badge
                  variant={employee.grade.isManagement ? "default" : "secondary"}
                  className="font-medium"
                >
                  {employee.grade.name}
                </Badge>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">役職</dt>
            <dd className="font-medium">{employee.position?.name || "-"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">基本給</dt>
            <dd className="font-medium">{formatSalary(employee.baseSalary)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
