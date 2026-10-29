import UIKit
import Capacitor
import WebKit
import AuthenticationServices

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
              let id = body["id"] as? String, UUID(uuidString: id) != nil,
              let name = body["name"] as? String,
              name.range(of: "^oracle-card-[0-9]+-(review\\.json|receipt\\.md|approved\\.md)$", options: .regularExpression) != nil,
              let text = body["text"] as? String, text.utf8.count <= 80 * 1024 * 1024,
              let controller = controller else { return }
        func reply(_ ok: Bool) {
            message.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('oracle-authoring-export-result',{detail:{id:'\(id)',ok:\(ok ? "true" : "false")}}));")
        }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(name)
            try text.write(to: file, atomically: true, encoding: .utf8)
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = controller.view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
            sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: folder) }
            controller.present(sheet, animated: true) { reply(true) }
        } catch { reply(false) }
    }
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
        let reply: (String?, String?) -> Void = { [weak webView = message.webView] code, error in
            guard let webView = webView, webView.url?.scheme == "capacitor", webView.url?.host == "localhost" else { return }
            var result: [String: String] = ["id": id, "state": state]
            if let code = code { result["code"] = code }
            if let error = error { result["error"] = error }
            guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('oracle-google-result',{detail:\(json)}));")
        }
        guard session == nil, controller?.view.window != nil else { reply(nil, "unavailable"); return }
        var start = URLComponents(string: "https://mandalacodes.com/api/auth/native/start")!
        start.queryItems = [URLQueryItem(name: "state", value: state), URLQueryItem(name: "challenge", value: challenge)]
        guard let url = start.url else { reply(nil, "unavailable"); return }
        let authentication = ASWebAuthenticationSession(url: url, callbackURLScheme: "oracle") { [weak self] callback, error in
            DispatchQueue.main.async {
                guard self?.activeID == id else { return }
                self?.session = nil
                self?.activeID = nil
                if let error = error {
                    let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    reply(nil, cancelled ? "cancelled" : "failed")
                    return
                }
                guard let callback = callback,
                      let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                      parts.scheme == "oracle", parts.host == "auth",
                      parts.user == nil, parts.password == nil, parts.port == nil,
                      parts.fragment == nil, parts.path.isEmpty || parts.path == "/" else { reply(nil, "invalid_callback"); return }
                let items = parts.queryItems ?? []
                guard items.count == 2, Set(items.map(\.name)).count == 2,
                      items.first(where: { $0.name == "state" })?.value == state else { reply(nil, "invalid_callback"); return }
                if items.contains(where: { $0.name == "error" }) { reply(nil, "failed"); return }
                guard let code = items.first(where: { $0.name == "code" })?.value,
                      code.range(of: "^[A-Za-z0-9_-]{32,128}$", options: .regularExpression) != nil else { reply(nil, "invalid_callback"); return }
                reply(code, nil)
            }
        }
        authentication.presentationContextProvider = self
        authentication.prefersEphemeralWebBrowserSession = false
        session = authentication
        activeID = id
        if !authentication.start() { session = nil; activeID = nil; reply(nil, "unavailable") }
    }
}
