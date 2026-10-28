import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = OracleViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
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
