import Cocoa
import SafariServices

class ViewController: NSViewController {

    @IBOutlet weak var appIconImageView: NSImageView!
    @IBOutlet weak var titleLabel: NSTextField!
    @IBOutlet weak var descriptionLabel: NSTextField!
    @IBOutlet weak var instructionsLabel: NSTextField!
    @IBOutlet weak var openSafariButton: NSButton!
    @IBOutlet weak var versionLabel: NSTextField!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    private func setupUI() {
        // App icon
        if let appIcon = NSImage(named: NSImage.applicationIconName) {
            appIconImageView.image = appIcon
        }

        // Title
        titleLabel.stringValue = "Claude Context Reporter"
        titleLabel.font = NSFont.systemFont(ofSize: 20, weight: .semibold)

        // Description
        descriptionLabel.stringValue = "Capture element context for AI assistants"
        descriptionLabel.textColor = NSColor.secondaryLabelColor

        // Instructions
        let instructions = """
        To enable the extension:

        1. Open Safari Settings (⌘,)
        2. Go to Extensions tab
        3. Enable "Claude Context Reporter"
        4. Right-click any element → "Capture for AI Context"
        """
        instructionsLabel.stringValue = instructions
        instructionsLabel.font = NSFont.systemFont(ofSize: 13)

        // Button
        openSafariButton.title = "Open Safari Extensions Settings"
        openSafariButton.bezelStyle = .rounded

        // Version
        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
           let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            versionLabel.stringValue = "Version \(version) (\(build))"
            versionLabel.textColor = NSColor.tertiaryLabelColor
            versionLabel.font = NSFont.systemFont(ofSize: 11)
        }
    }

    @IBAction func openSafariExtensionSettings(_ sender: Any) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.joshuascott.claude-context-reporter.Extension") { error in
            if let error = error {
                print("Error opening Safari extension settings: \(error)")
                // Fallback: open Safari preferences
                NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Safari-Settings.extension")!)
            }
        }
    }
}
