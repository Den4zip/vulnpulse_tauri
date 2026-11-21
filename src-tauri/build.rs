fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "list_demo_catalog",
            "query_catalog",
            "get_catalog_detail",
        ]),
    ))
    .expect("failed to build the Tauri application manifest");
}
