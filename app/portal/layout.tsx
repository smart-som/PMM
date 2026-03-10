import { DashboardLayout } from "@/components/DashboardLayout";

export default function PortalRouteLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
