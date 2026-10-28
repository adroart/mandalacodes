import Foundation
import WebKit
import UserNotifications
import UIKit
import CoreFoundation

/// A narrow bridge for an optional, user-created daily local reminder.
/// Register with addScriptMessageHandler(_:contentWorld:name:) in .page.
/// Reading status never requests permission and never schedules a notification.
final class OracleReminderHandler: NSObject, WKScriptMessageHandlerWithReply {
    static let identifier = "oracle.daily-reflection"
    private let center = UNUserNotificationCenter.current()
    private var changing = false

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              message.frameInfo.request.url?.host == "localhost" else {
            replyHandler(nil, "Only the installed Oracle app can manage reminders.")
            return
        }
        guard let body = message.body as? [String: Any],
              let id = body["requestId"] as? String, !id.isEmpty, id.count <= 80,
              let action = body["action"] as? String else {
            replyHandler(nil, "Invalid reminder request.")
            return
        }
        if action == "status" {
            status(id: id, reply: replyHandler)
            return
        }
        if action == "settings" {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                replyHandler(nil, "Settings could not be opened."); return
            }
            UIApplication.shared.open(url) { opened in
                replyHandler(opened ? ["requestId": id, "opened": true] : nil,
                             opened ? nil : "Settings could not be opened.")
            }
            return
        }
        guard action == "enable" || action == "disable" else {
            replyHandler(nil, "Unknown reminder action."); return
        }
        guard !changing else {
            replyHandler(nil, "A reminder change is already in progress."); return
        }
        var hour = 0, minute = 0
        if action == "enable" {
            guard let h = integer(body["hour"], in: 0...23),
                  let m = integer(body["minute"], in: 0...59) else {
                replyHandler(nil, "Choose a valid reminder time."); return
            }
            hour = h; minute = m
        }
        changing = true
        let finish: (Any?, String?) -> Void = { [weak self] value, error in
            DispatchQueue.main.async {
                self?.changing = false
                replyHandler(value, error)
            }
        }
        if action == "disable" {
            center.removePendingNotificationRequests(withIdentifiers: [Self.identifier])
            center.removeDeliveredNotifications(withIdentifiers: [Self.identifier])
            status(id: id, reply: finish)
            return
        }
        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { finish(nil, "Oracle closed before the reminder was saved."); return }
            if settings.authorizationStatus == .notDetermined {
                // Called only in response to the explicit Enable button.
                self.center.requestAuthorization(options: [.alert, .sound]) { granted, error in
                    if error != nil { finish(nil, "Notification permission could not be checked."); return }
                    guard granted else { self.status(id: id, reply: finish); return }
                    self.schedule(hour: hour, minute: minute, id: id, reply: finish)
                }
            } else if self.allowed(settings.authorizationStatus) {
                self.schedule(hour: hour, minute: minute, id: id, reply: finish)
            } else {
                self.status(id: id, reply: finish)
            }
        }
    }

    private func integer(_ value: Any?, in range: ClosedRange<Int>) -> Int? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID(),
              number.doubleValue.isFinite,
              number.doubleValue.rounded() == number.doubleValue,
              range.contains(number.intValue) else { return nil }
        return number.intValue
    }

    private func allowed(_ authorization: UNAuthorizationStatus) -> Bool {
        authorization == .authorized || authorization == .provisional || authorization == .ephemeral
    }

    private func schedule(hour: Int, minute: Int, id: String, reply: @escaping (Any?, String?) -> Void) {
        let content = UNMutableNotificationContent()
        content.title = "A moment with Oracle"
        content.body = "Pause, draw a card, and make room for reflection."
        content.sound = .default
        content.userInfo = ["oraclePath": "/home"]
        var date = DateComponents()
        date.hour = hour; date.minute = minute
        // No fixed time zone: repeat at the chosen local wall-clock time.
        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)
        let request = UNNotificationRequest(identifier: Self.identifier, content: content, trigger: trigger)
        // The stable identifier replaces the previous time without stacking alerts.
        center.add(request) { [weak self] error in
            guard error == nil else { reply(nil, "The reminder could not be saved. Please try again."); return }
            self?.status(id: id, reply: reply)
        }
    }

    private func status(id: String, reply: @escaping (Any?, String?) -> Void) {
        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { reply(nil, "Oracle closed before reminders could be checked."); return }
            self.center.getPendingNotificationRequests { requests in
                let pending = requests.first { $0.identifier == Self.identifier }
                let trigger = pending?.trigger as? UNCalendarNotificationTrigger
                let authorization: String
                switch settings.authorizationStatus {
                case .notDetermined: authorization = "notDetermined"
                case .denied: authorization = "denied"
                case .authorized: authorization = "authorized"
                case .provisional: authorization = "provisional"
                case .ephemeral: authorization = "ephemeral"
                @unknown default: authorization = "unknown"
                }
                let result: [String: Any] = [
                    "requestId": id,
                    "authorization": authorization,
                    "scheduled": pending != nil,
                    "enabled": pending != nil && self.allowed(settings.authorizationStatus),
                    "hour": trigger?.dateComponents.hour as Any? ?? NSNull(),
                    "minute": trigger?.dateComponents.minute as Any? ?? NSNull()
                ]
                DispatchQueue.main.async { reply(result, nil) }
            }
        }
    }
}
