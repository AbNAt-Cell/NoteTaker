"use client";

import { useState } from "react";
import { Sparkles, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMeetingsStore } from "@/stores/meetings-store";
import type { Meeting, TranscriptSegment } from "@/types/vexa";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
    meeting: Meeting;
    transcripts: TranscriptSegment[];
}

export function SummaryPanel({ meeting, transcripts }: SummaryPanelProps) {
    const { updateMeetingData } = useMeetingsStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    const hasSummary = !!meeting.data?.summary;
    const summaryText = meeting.data?.summary || "";

    const generateSummary = async () => {
        if (transcripts.length === 0) {
            toast.error("No transcript available to summarize.");
            return;
        }

        setIsGenerating(true);
        try {
            const response = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ segments: transcripts }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate summary");
            }

            const data = await response.json();

            await updateMeetingData(meeting.platform, meeting.platform_specific_id, {
                summary: data.summary,
            });

            toast.success("Summary generated successfully");
            setIsExpanded(true);
        } catch (error) {
            console.error("Summary generation error:", error);
            toast.error("Failed to generate summary. Please try again later.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!hasSummary && transcripts.length === 0) {
        return null; // Don't show panel if no summary and no transcript to summarize
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between py-4 cursor-pointer" onClick={() => hasSummary && setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-md font-semibold">AI Summary</CardTitle>
                </div>
                {hasSummary && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                )}
            </CardHeader>
            {isExpanded && (
                <CardContent className="pt-4">
                    {!hasSummary ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                            <Sparkles className="h-10 w-10 text-muted-foreground/30" />
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm">No Summary Yet</h4>
                                <p className="text-xs text-muted-foreground max-w-[200px]">
                                    Generate an AI summary of this meeting's transcript to quickly catch up on key details.
                                </p>
                            </div>
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    generateSummary();
                                }}
                                disabled={isGenerating}
                                className="w-full mt-2"
                                variant="secondary"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate Summary
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h4:text-base prose-h4:mt-3 prose-h4:mb-2 prose-p:text-sm prose-li:text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {summaryText}
                            </ReactMarkdown>

                            <div className="flex justify-end mt-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        generateSummary();
                                    }}
                                    disabled={isGenerating}
                                    className="text-xs"
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Regenerating...</>
                                    ) : (
                                        "Regenerate"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
