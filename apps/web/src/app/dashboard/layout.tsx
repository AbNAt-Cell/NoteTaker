import { AppLayout } from "@/components/layout/app-layout";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider delayDuration={0}>
            <AppLayout>{children}</AppLayout>
        </TooltipProvider>
    );
}
