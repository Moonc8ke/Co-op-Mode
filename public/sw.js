/* Co-op Mode service worker — push notifications ONLY.
 *
 * Deliberately NO fetch handler and NO caching of any kind. The app
 * stays a plain website that always loads fresh, so you never get a
 * stale copy and it can't interfere with sign-in. This worker only
 * does two things: show a notification when the server pushes one,
 * and open the app when you tap it.
 */

self.addEventListener("push", (event) => {
  let title = "Co-op Mode";
  let body = "Something new in your book.";
  try {
    const data = event.data ? event.data.json() : null;
    if (data) {
      if (typeof data.title === "string" && data.title) title = data.title;
      if (typeof data.body === "string" && data.body) body = data.body;
    }
  } catch {
    // A push with no JSON payload — the default text above stands.
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "co-op-mode",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      }),
  );
});
