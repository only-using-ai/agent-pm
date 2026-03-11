use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let app_submenu = SubmenuBuilder::new(app.handle(), "Agent PM")
        .quit()
        .build()?;
      let refresh =
        MenuItemBuilder::with_id("refresh-app", "Refresh App").build(app.handle())?;
      let window_submenu =
        SubmenuBuilder::new(app.handle(), "Window").item(&refresh).build()?;
      let menu = MenuBuilder::new(app.handle())
        .item(&app_submenu)
        .item(&window_submenu)
        .build()?;
      app.set_menu(menu)?;
      Ok(())
    })
    .on_menu_event(|app, event| {
      if event.id().as_ref() == "refresh-app" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("window.location.reload()");
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
