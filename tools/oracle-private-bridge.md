# Private Oracle phone connection

This service wraps the existing AR Create transcription and bounded writing adapters. It binds only `127.0.0.1:8842`. Tailscale Serve provides private tailnet HTTPS on a dedicated port. Never use Funnel, a public tunnel, `0.0.0.0`, or disabled TLS verification.

On this Mac, the service is installed as `com.mandalacodes.oracle-private-bridge` in `~/Library/LaunchAgents`. It starts at login and restarts on failure. Its source path is this worktree's `tools/oracle-private-bridge.mjs`; retain this worktree while the service is installed. Runtime logs and the private pairing key are under `~/Library/Application Support/Mandala Codes/oracle-authoring-bridge/`. The key is generated once with 256 bits of randomness in a mode-0600 file and never printed to logs.

Open <http://127.0.0.1:8842/pairing> directly on this Mac to see the private address and key. The setup page is inaccessible through the tailnet proxy, checks loopback Host and request origin, disallows framing and scripts, and does not cache or load external resources. Copy the address and key into **Connect to your Mac** inside Oracle on the phone, then tap **Test connection**. The test reads capabilities only. It sends no audio and starts no writing job. The phone must be signed into the same private Tailscale network, and the Mac must remain awake. The phone stores the endpoint and key locally, separately from account sign-in; Disconnect removes both from that device. To revoke all copies, stop the service, remove only its pairing-key file, and restart it, then pair again.

Configured endpoint:

`https://creation.taile3a9a2.ts.net:8443/api/oracle/authoring/ar-create`

Only authenticated JSON POST operations `capabilities`, `transcribe`, `transcription-status`, `propose`, and `writing-status` are forwarded. The native client requires the explicit HTTPS endpoint, sends its bearer key only there, disables redirects, and rejects a changed response URL. Browser and Mac preview requests retain the existing same-origin route. The private server accepts only the native `capacitor://localhost` origin, with no account cookies or authentication session used by its protocol.

For another Mac, start the service with these environment variables:

- `ORACLE_PRIVATE_BRIDGE_ENDPOINT`: exact tailnet HTTPS endpoint including `/api/oracle/authoring/ar-create`.
- `ORACLE_PRIVATE_BRIDGE_PORT`: local port, default `8842`.
- `ORACLE_PRIVATE_BRIDGE_SECRET_FILE`: optional private key path.
- `ORACLE_AR_CREATE_RUNNER`: explicit path to the existing maintained AR Create `runtime/services/artifact-execution.mjs` when this repository is in a worktree.

Run `node tools/oracle-private-bridge.mjs`. After inspecting `tailscale serve status --json` for conflicts, use `tailscale serve --bg --https=8443 --set-path=/api/oracle/authoring/ar-create http://127.0.0.1:8842/api/oracle/authoring/ar-create`. This adds only the dedicated API route. To remove that private proxy, use `tailscale serve --https=8443 off`. Stop the Mac service with `launchctl bootout gui/$(id -u)/com.mandalacodes.oracle-private-bridge` and remove its LaunchAgent if no longer wanted.

Verified 2026-10-28: authenticated read-only HTTPS capabilities returned 200, transcription ready and existing writing runner available. The paired iPhone's Tailscale node was offline with an expired key, so phone sign-in renewal and physical pairing remain necessary. No private recording was used for connection testing. This setup does not install or update the phone app and does not publish the website.
