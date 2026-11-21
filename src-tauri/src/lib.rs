mod application;
mod commands;
mod contracts;
mod domain;
mod infrastructure;

use tauri::{webview::NewWindowResponse, Url, WebviewWindowBuilder};

fn is_app_url(url: &Url, dev_url: Option<&Url>) -> bool {
    let bundled = matches!(
        (url.scheme(), url.host_str(), url.port()),
        ("http", Some("tauri.localhost"), None) | ("tauri", Some("localhost"), None)
    );
    bundled || dev_url.is_some_and(|dev| url.origin() == dev.origin())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::DemoState::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_demo_catalog,
            commands::query_catalog,
            commands::get_catalog_detail,
        ])
        .setup(|app| {
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .expect("missing main window configuration");
            let dev_url = if tauri::is_dev() {
                app.config().build.dev_url.clone()
            } else {
                None
            };
            WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(move |url| is_app_url(url, dev_url.as_ref()))
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run VulnPulse");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn navigation_allows_only_bundled_ui_and_the_exact_dev_origin() {
        let dev = Url::parse("http://127.0.0.1:1420").unwrap();
        let windows = Url::parse("http://tauri.localhost/index.html").unwrap();
        let desktop = Url::parse("tauri://localhost/index.html").unwrap();
        assert!(is_app_url(&windows, None));
        assert!(is_app_url(&desktop, None));
        assert!(is_app_url(&dev, Some(&dev)));
        assert!(!is_app_url(&dev, None));

        for address in [
            "http://127.0.0.1:1421/",
            "http://tauri.localhost:1420/",
            "http://tauri.localhost.example/",
            "https://example.invalid/",
            "file:///index.html",
        ] {
            assert!(!is_app_url(&Url::parse(address).unwrap(), Some(&dev)));
        }
    }
}
