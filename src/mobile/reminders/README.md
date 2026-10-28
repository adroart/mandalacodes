# Optional daily local reminder

- Add `OracleReminderHandler.swift` to the App target's Sources.
- In OracleViewController's `webView(with:configuration:)`, register once before
  creating the web view:

```swift
configuration.userContentController.addScriptMessageHandler(
    OracleReminderHandler(), contentWorld: .page, name: "oracleReminders")
```

- Render `<ReminderSettings />` on the Account/settings page. This component
  checks actual native pending requests on mount and return to foreground.
  It never requests permission until Enable reminder is tapped. The user chooses
  a local time, can change it or disable, and can open iPhone Settings if denied.
- The stable identifier `oracle.daily-reflection` replaces rather than duplicates
  reminders. No remote push, APNs entitlement, account or network is needed.
- Native handlers accept only the bundled capacitor://localhost main frame.
  Replies use WKScriptMessageHandlerWithReply (iOS14+, deployment target15),
  not evaluateJavaScript; request IDs are checked and JS timeout is explicit.
- Notification content carries `userInfo["oraclePath"] = "/home"`. Parent must
  route notification taps via the app's UNUserNotificationCenterDelegate and
  scene connectionOptions.notificationResponse. Keep that route allowlisted.
- No Info.plist permission description is needed for user-notification alerts.
- Daily calendar trigger omits a fixed zone, following device local wall time.
- Delivery still follows iOS Focus/notification settings. A pending request is
  not proof that a physical phone displayed it.

Verification: bridge unit tests, standalone Swift typecheck. Actual permission
prompt, denied/granted settings, delivery and tap handling require simulator/
physical-device checks after parent integration. No reminder was scheduled by
this development work.

Primary references:
https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app
https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply
