import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type NotificationRecord = {
  id: string;
  recipient_id: string;
  actor_id: string;
  notification_type: string;
  post_id: string | null;
  comment_id: string | null;
};

type DatabaseWebhookPayload = {
  type: "INSERT";
  table: "notifications";
  schema: "public";
  record: NotificationRecord;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const secretKeysValue = Deno.env.get("SUPABASE_SECRET_KEYS");
const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

function getAdminKey(): string {
  if (secretKeysValue) {
    const keys = JSON.parse(secretKeysValue) as Record<string, string>;
    if (keys.default) return keys.default;
  }
  if (legacyServiceRoleKey) return legacyServiceRoleKey;
  throw new Error("Supabase server key is not configured.");
}

const supabase = createClient(supabaseUrl!, getAdminKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const preferenceForType: Record<string, string> = {
  post_like: "likes_enabled",
  post_comment: "comments_enabled",
  comment_reply: "comments_enabled",
  follow_request: "follows_enabled",
  new_follower: "follows_enabled",
  follow_accepted: "follows_enabled",
  post_repost: "reposts_enabled",
};

function notificationCopy(type: string, actorName: string) {
  switch (type) {
    case "post_like": return { title: "CREOVA · New like", body: actorName + " liked your post." };
    case "post_comment": return { title: "CREOVA · New comment", body: actorName + " commented on your post." };
    case "comment_reply": return { title: "CREOVA · New reply", body: actorName + " replied to your comment." };
    case "follow_request": return { title: "CREOVA · Follow request", body: actorName + " wants to follow you." };
    case "new_follower": return { title: "CREOVA · New follower", body: actorName + " started following you." };
    case "follow_accepted": return { title: "CREOVA · Request accepted", body: actorName + " accepted your follow request." };
    case "post_repost": return { title: "CREOVA · Repost", body: actorName + " reposted your content." };
    default: return { title: "CREOVA · New activity", body: actorName + " interacted with you." };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!expoAccessToken) {
    return Response.json({ error: "EXPO_ACCESS_TOKEN secret is not configured." }, { status: 503 });
  }

  let payload: DatabaseWebhookPayload;
  try {
    payload = await request.json() as DatabaseWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications" || payload.schema !== "public" ||
      !payload.record?.id || !payload.record?.recipient_id || !payload.record?.notification_type) {
    return Response.json({ error: "Unsupported webhook payload." }, { status: 400 });
  }

  const record = payload.record;
  const preferenceKey = preferenceForType[record.notification_type];
  if (!preferenceKey) return Response.json({ skipped: "unsupported_notification_type" });

  const [{ data: notification, error: notificationError }, { data: preferences, error: preferenceError }, { data: devices, error: devicesError }] = await Promise.all([
    supabase.from("notifications")
      .select("id, recipient_id, actor_id, notification_type, post_id, comment_id, actor:profiles!notifications_actor_id_fkey(username, display_name)")
      .eq("id", record.id)
      .maybeSingle(),
    supabase.from("notification_preferences")
      .select("likes_enabled, comments_enabled, follows_enabled, reposts_enabled")
      .eq("user_id", record.recipient_id)
      .maybeSingle(),
    supabase.from("user_push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", record.recipient_id)
      .eq("is_active", true),
  ]);

  if (notificationError || preferenceError || devicesError) {
    return Response.json({ error: "Could not load notification delivery data." }, { status: 500 });
  }
  if (!notification) return Response.json({ skipped: "notification_not_found" });
  if (preferences && preferences[preferenceKey] === false) return Response.json({ skipped: "preference_disabled" });
  if (!devices?.length) return Response.json({ skipped: "no_active_devices" });

  const actor = Array.isArray(notification.actor) ? notification.actor[0] : notification.actor;
  const actorName = actor?.display_name || actor?.username || "Someone";
  const copy = notificationCopy(notification.notification_type, actorName);
  const data = {
    notificationId: notification.id,
    notificationType: notification.notification_type,
    postId: notification.post_id,
    commentId: notification.comment_id,
    actorUsername: actor?.username ?? null,
  };

  const messages = devices.map(device => ({
    to: device.expo_push_token,
    title: copy.title,
    body: copy.body,
    sound: "default",
    priority: "high",
    channelId: "creova-activity",
    data,
  }));

  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      Authorization: "Bearer " + expoAccessToken,
    },
    body: JSON.stringify(messages),
  });

  const expoResult = await expoResponse.json();
  if (!expoResponse.ok) {
    return Response.json({ error: "Expo Push Service rejected the request.", details: expoResult }, { status: 502 });
  }

  const tickets = Array.isArray(expoResult.data) ? expoResult.data : [expoResult.data];
  const invalidTokens = tickets.flatMap((ticket: { status?: string; details?: { error?: string } }, index: number) =>
    ticket?.details?.error === "DeviceNotRegistered" ? [devices[index]?.id].filter(Boolean) : []
  );

  if (invalidTokens.length) {
    await supabase.from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", invalidTokens);
  }

  return Response.json({
    sent: tickets.filter((ticket: { status?: string }) => ticket?.status === "ok").length,
    failed: tickets.filter((ticket: { status?: string }) => ticket?.status === "error").length,
    deactivatedInvalidDevices: invalidTokens.length,
  });
});
