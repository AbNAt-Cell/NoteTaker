import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { query } from "@/lib/db";

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("Fetching meetings from Postgres for user:", user.id);
        let res;
        try {
            res = await query(
                'SELECT * FROM meetings WHERE user_id = $1 ORDER BY created_at DESC',
                [user.id]
            );
        } catch (dbErr: any) {
            console.error("Database error during meetings fetch:", dbErr);
            return NextResponse.json({ error: "Database connection timeout or failure" }, { status: 503 });
        }

        return NextResponse.json(res.rows);
    } catch (error: any) {
        console.error("Global fetch meetings error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
