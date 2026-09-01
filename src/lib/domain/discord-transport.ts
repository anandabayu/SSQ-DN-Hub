import "server-only";

/**
 * Discord webhook transport.
 *
 * Kept apart from the route so the forum-channel rules live in one place:
 *
 *   A webhook posting to a FORUM channel must either name a new thread
 *   (`thread_name` in the body) or target an existing one (`?thread_id=`).
 *   Without either, Discord replies 400 / code 220001. Text channels accept
 *   neither requirement, and reject `thread_name` outright.
 *
 * Rather than asking the admin which kind of channel they configured, we try
 * the plain post and retry with `thread_name` only when Discord tells us it
 * needed one. That works for both channel types with no extra setup.
 */

/** Discord's error code for "this forum post needs a thread". */
const FORUM_THREAD_REQUIRED = 220001;

/** Discord caps thread names at 100 characters. */
const MAX_THREAD_NAME = 100;

export interface DiscordMessage {
  id?: string;
  /** For a forum post this is the *thread* the message landed in. */
  channel_id?: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  detail: string;
  message: DiscordMessage;
  /** True when this call created a new forum thread. */
  createdThread: boolean;
}

function withQuery(url: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

async function readBody(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

function errorCode(detail: string): number | null {
  try {
    return (JSON.parse(detail) as { code?: number }).code ?? null;
  } catch {
    return null;
  }
}

/**
 * Posts a new message. When `threadId` is absent and the channel turns out to
 * be a forum, retries once with `thread_name` to open the thread.
 */
export async function postMessage(
  webhookUrl: string,
  payload: Record<string, unknown>,
  options: { threadId?: string; threadName?: string },
): Promise<SendResult> {
  const { threadId, threadName } = options;

  const send = async (body: Record<string, unknown>, useThreadName: boolean) => {
    const url = withQuery(
      webhookUrl,
      threadId ? { thread_id: threadId, wait: "true" } : { wait: "true" },
    );

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        useThreadName && threadName
          ? { ...body, thread_name: threadName.slice(0, MAX_THREAD_NAME) }
          : body,
      ),
    });

    const detail = response.ok ? "" : await readBody(response);
    const message = response.ok
      ? ((await response.json().catch(() => ({}))) as DiscordMessage)
      : {};

    return { response, detail, message };
  };

  let attempt = await send(payload, false);

  // Forum channel and no thread targeted: open one named after the party.
  const needsThread =
    !attempt.response.ok &&
    !threadId &&
    !!threadName &&
    errorCode(attempt.detail) === FORUM_THREAD_REQUIRED;

  if (needsThread) {
    attempt = await send(payload, true);

    return {
      ok: attempt.response.ok,
      status: attempt.response.status,
      detail: attempt.detail,
      message: attempt.message,
      createdThread: attempt.response.ok,
    };
  }

  return {
    ok: attempt.response.ok,
    status: attempt.response.status,
    detail: attempt.detail,
    message: attempt.message,
    createdThread: false,
  };
}

/**
 * Edits a message already posted, so re-sending the roster or the loot list
 * updates the existing post instead of stacking duplicates in the thread.
 */
export async function patchMessage(
  webhookUrl: string,
  messageId: string,
  payload: Record<string, unknown>,
  threadId?: string,
): Promise<SendResult> {
  const base = `${webhookUrl}/messages/${encodeURIComponent(messageId)}`;
  const url = threadId ? withQuery(base, { thread_id: threadId }) : base;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const detail = response.ok ? "" : await readBody(response);
  const message = response.ok
    ? ((await response.json().catch(() => ({}))) as DiscordMessage)
    : {};

  return {
    ok: response.ok,
    status: response.status,
    detail,
    message,
    createdThread: false,
  };
}

/**
 * Removes a previously posted message.
 *
 * Used by the loot update, which reposts rather than edits: editing leaves the
 * update stranded wherever it was first posted, which is useless once the
 * thread has a long discussion under it. Posting fresh and deleting the old
 * one keeps the latest state at the bottom with no duplicates.
 *
 * Best-effort by design — a 404 means someone already deleted it by hand,
 * which is not a failure worth surfacing.
 */
export async function deleteMessage(
  webhookUrl: string,
  messageId: string,
  threadId?: string,
): Promise<boolean> {
  const base = `${webhookUrl}/messages/${encodeURIComponent(messageId)}`;
  const url = threadId ? withQuery(base, { thread_id: threadId }) : base;

  try {
    const response = await fetch(url, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** Discord's own message/code, for surfacing to the operator. */
export function describeError(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as { message?: string; code?: number };
    if (!parsed.message) return "";
    return ` — ${parsed.message}${parsed.code ? ` (code ${parsed.code})` : ""}`;
  } catch {
    return "";
  }
}
