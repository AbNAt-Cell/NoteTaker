import { createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function GET() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "DEEPGRAM_API_KEY not configured on server" }, { status: 500 });
    }

    try {
        const deepgram = createClient(apiKey);

        // 1. Get the first project
        const { result: projectsResult, error: projectsError } = await deepgram.manage.getProjects();

        if (projectsError) {
            console.error("Deepgram getProjects error:", projectsError);
            throw new Error(`Failed to get Deepgram projects: ${projectsError.message}`);
        }

        if (!projectsResult || projectsResult.projects.length === 0) {
            throw new Error("No Deepgram projects found for this API key");
        }

        const projectId = projectsResult.projects[0].project_id;

        // 2. Create a temporary key (valid for 1 hour) for live transcription from the browser
        const { result: keyResult, error: keyError } = await deepgram.manage.createProjectKey(
            projectId,
            {
                comment: "Vexa Dashboard Temp Key",
                scopes: ["usage:write"],
                time_to_live_in_seconds: 7200, // 2 hours is plenty for a meeting
            }
        );

        if (keyError) {
            console.error("Deepgram createProjectKey error:", keyError);
            throw new Error(`Failed to create temp key: ${keyError.message}`);
        }

        return NextResponse.json({ key: keyResult.key });
    } catch (error: any) {
        console.error("Error creating Deepgram temp key:", error);
        return NextResponse.json({ error: error.message || "Unknown error creating Deepgram key" }, { status: 500 });
    }
}
