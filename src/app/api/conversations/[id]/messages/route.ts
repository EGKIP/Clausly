import { NextResponse } from "next/server";
import { loadConversationMessages } from "@/lib/db/conversations";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ messages: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({
      messages: await loadConversationMessages(supabase, user.id, id, 100),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ConversationNotFoundError") {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversation messages could not be loaded." },
      { status: 500 }
    );
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
