import UIKit
import Capacitor
import WebKit

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
