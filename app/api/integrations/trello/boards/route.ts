import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/guards";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";
import { isTrelloConfigured, listTrelloBoards } from "@/lib/trello";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  if (!isTrelloConfigured()) {
    return NextResponse.json(
      { configured: false, message: "Trello is not configured on the EchoTrace server." },
      { status: 503 }
    );
  }

  try {
    const boards = await listTrelloBoards();
    logServerEvent("api:/api/integrations/trello/boards", "list", {
      count: boards.length,
      user: auth.session.email
    });
    return NextResponse.json({ boards, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trello boards could not be loaded.";
    logServerError("api:/api/integrations/trello/boards", "failed", describeError(error));
    return NextResponse.json({ configured: true, message }, { status: 502 });
  }
}
