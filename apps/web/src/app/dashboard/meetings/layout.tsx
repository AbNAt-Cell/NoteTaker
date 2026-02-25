import { JoinModal } from "@/components/join/join-modal";

export default function MeetingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex-1 w-full h-full p-4 lg:p-8 overflow-y-auto">
            {children}
            <JoinModal />
        </div>
    );
}
