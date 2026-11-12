import UIKit
import Capacitor
import WebKit
import AuthenticationServices
import AVFoundation

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let controller = OracleViewController()
        controller.pendingOraclePath = connectionOptions.urlContexts.first.flatMap { oraclePath($0.url) }
        if connectionOptions.notificationResponse?.notification.request.content.userInfo["oraclePath"] as? String == "/home" {
            controller.pendingOraclePath = "/home"
        }
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url, let path = oraclePath(url),
           let controller = window?.rootViewController as? OracleViewController {
            controller.openOraclePath(path)
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // The idle timer never stays off behind a locked or hidden screen.
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        (window?.rootViewController as? OracleViewController)?.stopRecordingGuard()
    }
}

/// Read Capacitor's startup settings without a synchronous WebKit prompt.
/// On iOS 27 the document-start prompt can stall before WKUIDelegate receives it.
/// Ordinary JavaScript prompts still use Capacitor's normal native delegate.
class OracleViewController: CAPBridgeViewController {
    var pendingOraclePath: String?
    func openOraclePath(_ path: String) {
        pendingOraclePath = path
        // Paths come only from oraclePath's fixed route/number allowlist.
        webView?.evaluateJavaScript("history.pushState(null, '', '\(path)'); window.dispatchEvent(new PopStateEvent('popstate'));")
    }
    fileprivate let recordingHandler = OracleRecordingHandler()
    func stopRecordingGuard() {
        recordingHandler.stop()
    }
    private var cookiesEnabled = false
    private var httpEnabled = false

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        cookiesEnabled = instanceConfiguration.getPluginConfig("CapacitorCookies").getBoolean("enabled", false)
        httpEnabled = instanceConfiguration.getPluginConfig("CapacitorHttp").getBoolean("enabled", false)
        return super.webViewConfiguration(for: instanceConfiguration)
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        // This hook runs after Capacitor assigns its content controller and before
        // it injects native-bridge.js, so the answers exist before initialization.
        if let path = pendingOraclePath {
            configuration.userContentController.addUserScript(WKUserScript(source: "history.replaceState(null, '', '\(path)');", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        configuration.userContentController.addScriptMessageHandler(OracleReminderHandler(), contentWorld: .page, name: "oracleReminders")
        configuration.userContentController.add(OracleFeedbackHandler(), name: "oracleFeedback")
        configuration.userContentController.add(OracleGoogleAuthHandler(controller: self), name: "oracleGoogleAuth")
        configuration.userContentController.add(OracleAuthoringExportHandler(controller: self), name: "oracleAuthoringExport")
        configuration.userContentController.add(recordingHandler, name: "oracleRecording")
        configuration.userContentController.addUserScript(WKUserScript(source: """
        (() => {
            const originalPrompt = window.prompt.bind(window);
            window.prompt = function(message, defaultValue) {
                try {
                    const type = JSON.parse(message).type;
                    if (!\(cookiesEnabled) && type === 'CapacitorCookies.isEnabled') return 'false';
                    if (!\(httpEnabled) && type === 'CapacitorHttp') return 'false';
                } catch (_) {}
                return originalPrompt(message, defaultValue);
            };
        })();
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        return super.webView(with: frame, configuration: configuration)
    }
}

/// Only the bundled main frame may request gentle selection feedback.
private final class OracleFeedbackHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              message.frameInfo.request.url?.host == "localhost",
              message.body as? String == "selection" else { return }
        UISelectionFeedbackGenerator().selectionChanged()
    }
}

/// Keeps the screen awake during a take and tells the page when the microphone may
/// have been taken away. It only observes the audio session: WebKit owns it for
/// getUserMedia, so nothing here sets a category or activates the session.
private final class OracleRecordingHandler: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private var observers: [NSObjectProtocol] = []
    private var active = false

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              message.frameInfo.request.url?.host == "localhost",
              let body = message.body as? [String: Any],
              let recording = body["active"] as? Bool else { return }
        if recording { start(message.webView) } else { stop() }
    }

    private func start(_ webView: WKWebView?) {
        self.webView = webView
        UIApplication.shared.isIdleTimerDisabled = true
        guard !active else { return }
        active = true
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()
        observers = [
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { [weak self] note in
                self?.interruption(note)
            },
            center.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { [weak self] note in
                self?.routeChange(note)
            },
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.send(["kind": "inactive"])
            },
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                guard let self = self, self.active else { return }
                UIApplication.shared.isIdleTimerDisabled = true
                self.send(["kind": "active"])
            }
        ]
    }

    func stop() {
        UIApplication.shared.isIdleTimerDisabled = false
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers = []
        active = false
    }

    private func interruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            send(["kind": "interruption-began"])
        case .ended:
            var event: [String: Any] = ["kind": "interruption-ended"]
            if let options = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt {
                event["shouldResume"] = AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume)
            }
            send(event)
        @unknown default:
            break
        }
    }

    private func routeChange(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
        switch reason {
        case .oldDeviceUnavailable:
            send(["kind": "route-changed", "reason": "old-device-unavailable"])
        case .newDeviceAvailable:
            send(["kind": "route-changed", "reason": "new-device-available"])
        default:
            break
        }
    }

    private func send(_ event: [String: Any]) {
        // A page that went away cannot say it stopped, so its guard ends here.
        guard let webView = webView else { stop(); return }
        guard webView.url?.scheme == "capacitor", webView.url?.host == "localhost",
              let data = try? JSONSerialization.data(withJSONObject: event),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('oracle-recording-native',{detail:\(json)}));")
    }
}

private func oraclePath(_ url: URL) -> String? {
    guard url.scheme == "oracle" else { return nil }
    if url.host == "home" { return "/home" }
    guard url.host == "card", let number = Int(url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))), (1...64).contains(number) else { return nil }
    return "/universal-language/\(number)"
}

/// Private review exports use an explicit system share sheet, never an automatic upload.
private final class OracleAuthoringExportHandler: NSObject, WKScriptMessageHandler {
    weak var controller: UIViewController?
    init(controller: UIViewController) { self.controller = controller }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              message.frameInfo.request.url?.host == "localhost",
              let body = message.body as? [String: Any],
              let id = body["id"] as? String, UUID(uuidString: id) != nil else { return }
        // id is a checked UUID, so it is safe inside the script below.
        func reply(_ detail: String) {
            message.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('oracle-authoring-export-result',{detail:{id:'\(id)',\(detail)}}));")
        }
        guard let name = body["name"] as? String,
              name.range(of: "^oracle-card-[0-9]+-(review\\.json|receipt\\.md|approved\\.md)$", options: .regularExpression) != nil
                || name.range(of: "^oracle-voice-card-[0-9]{2}-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json$", options: .regularExpression) != nil else { reply("ok:false,reason:'name'"); return }
        guard let text = body["text"] as? String, text.utf8.count <= 80 * 1024 * 1024 else { reply("ok:false,reason:'text'"); return }
        guard let controller = controller else { reply("ok:false,reason:'unavailable'"); return }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(name)
            try text.write(to: file, atomically: true, encoding: .utf8)
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = controller.view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
            var finished = false
            // A cancelled sub-activity (closing the Files picker, say) can return to the sheet, so report once the sheet is gone or something was sent.
            sheet.completionWithItemsHandler = { [weak sheet] activityType, completed, _, _ in
                let stillShown = sheet?.presentingViewController != nil && sheet?.isBeingDismissed == false
                guard !finished, completed || activityType == nil || !stillShown else { return }
                finished = true
                try? FileManager.default.removeItem(at: folder)
                reply("ok:true,completed:\(completed ? "true" : "false")")
            }
            controller.present(sheet, animated: true) { reply("ok:true,stage:'presented'") }
        } catch { reply("ok:false,reason:'file'") }
    }
}

private enum OracleGoogleReturnStage: String {
    case presentationUnavailable = "presentation-unavailable"
    case systemError = "system-error"
    case callbackMissing = "callback-missing"
    case callbackURLShape = "callback-url-shape"
    case callbackQueryCount = "callback-query-count"
    case callbackStateMismatch = "callback-state-mismatch"
    case callbackServerError = "callback-server-error"
    case callbackCodeInvalid = "callback-code-invalid"
    case success
}

/// Overwrite one small cache record. No URL, credential, account or raw error text
/// may enter this dictionary; it exists only to locate a failed native return.
private func recordOracleGoogleDiagnostic(_ stage: OracleGoogleReturnStage, codePresent: Bool, systemError: NSError?) {
    var diagnostic: [String: Any] = [
        "stage": stage.rawValue,
        "timestamp": ISO8601DateFormatter().string(from: Date()),
        "codePresent": codePresent
    ]
    if let error = systemError,
       [ASWebAuthenticationSessionErrorDomain, NSURLErrorDomain, NSCocoaErrorDomain].contains(error.domain) {
        diagnostic["errorDomain"] = error.domain
        diagnostic["errorCode"] = error.code
    }
    guard let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
          let data = try? JSONSerialization.data(withJSONObject: diagnostic, options: [.sortedKeys]) else { return }
    try? data.write(to: folder.appendingPathComponent("oracle-google-diagnostic.json"), options: .atomic)
}

/// Google's credentials stay in the system authentication browser. Only a
/// proof-bound handoff code returns to the bundled Oracle main frame.
private final class OracleGoogleAuthHandler: NSObject, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
    weak var controller: UIViewController?
    private var session: ASWebAuthenticationSession?
    private var activeID: String?
    init(controller: UIViewController) { self.controller = controller }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        controller?.view.window ?? ASPresentationAnchor()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              message.frameInfo.request.url?.host == "localhost",
              let body = message.body as? [String: Any],
              let id = body["id"] as? String, UUID(uuidString: id) != nil else { return }
        if body["action"] as? String == "cancel" {
            if activeID == id { session?.cancel(); session = nil; activeID = nil }
            return
        }
        guard body["action"] as? String == "start",
              let state = body["state"] as? String,
              let challenge = body["challenge"] as? String,
              state.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil,
              challenge.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else { return }
        var callbackCodePresent = false
        let reply: (String?, String?, OracleGoogleReturnStage, NSError?) -> Void = { [weak webView = message.webView] code, error, stage, systemError in
            recordOracleGoogleDiagnostic(stage, codePresent: code != nil || callbackCodePresent, systemError: systemError)
            guard let webView = webView, webView.url?.scheme == "capacitor", webView.url?.host == "localhost" else { return }
            var result: [String: String] = ["id": id, "state": state, "stage": stage.rawValue]
            if let code = code { result["code"] = code }
            if let error = error { result["error"] = error }
            guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('oracle-google-result',{detail:\(json)}));")
        }
        guard session == nil, controller?.view.window != nil else { reply(nil, "unavailable", .presentationUnavailable, nil); return }
        var start = URLComponents(string: "https://mandalacodes.com/api/auth/native/start")!
        start.queryItems = [URLQueryItem(name: "state", value: state), URLQueryItem(name: "challenge", value: challenge)]
        guard let url = start.url else { reply(nil, "unavailable", .presentationUnavailable, nil); return }
        let authentication = ASWebAuthenticationSession(url: url, callbackURLScheme: "oracle") { [weak self] callback, error in
            DispatchQueue.main.async {
                guard self?.activeID == id else { return }
                self?.session = nil
                self?.activeID = nil
                let parts = callback.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
                callbackCodePresent = parts?.queryItems?.contains(where: { $0.name == "code" }) ?? false
                if let error = error {
                    let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    reply(nil, cancelled ? "cancelled" : "failed", .systemError, error as NSError)
                    return
                }
                guard callback != nil else { reply(nil, "invalid_callback", .callbackMissing, nil); return }
                guard let parts = parts,
                      parts.scheme == "oracle", parts.host == "auth",
                      parts.user == nil, parts.password == nil, parts.port == nil,
                      parts.fragment == nil, parts.path.isEmpty || parts.path == "/" else { reply(nil, "invalid_callback", .callbackURLShape, nil); return }
                let items = parts.queryItems ?? []
                guard items.count == 2, Set(items.map(\.name)).count == 2 else { reply(nil, "invalid_callback", .callbackQueryCount, nil); return }
                guard items.first(where: { $0.name == "state" })?.value == state else { reply(nil, "invalid_callback", .callbackStateMismatch, nil); return }
                if items.contains(where: { $0.name == "error" }) { reply(nil, "failed", .callbackServerError, nil); return }
                guard let code = items.first(where: { $0.name == "code" })?.value,
                      code.range(of: "^[A-Za-z0-9_-]{32,128}$", options: .regularExpression) != nil else { reply(nil, "invalid_callback", .callbackCodeInvalid, nil); return }
                reply(code, nil, .success, nil)
            }
        }
        authentication.presentationContextProvider = self
        authentication.prefersEphemeralWebBrowserSession = false
        session = authentication
        activeID = id
        if !authentication.start() { session = nil; activeID = nil; reply(nil, "unavailable", .presentationUnavailable, nil) }
    }
}
