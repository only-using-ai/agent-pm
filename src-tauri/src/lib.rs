use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::LogicalSize;
use tauri::{Emitter, Manager};

const SETTINGS_FILENAME: &str = "settings.json";
const LOG_FILENAME: &str = "agent-pm.log";

#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct AppSettings {
  #[serde(default)]
  pub(crate) log_to_file: bool,
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn app_settings_default() {
    let s = AppSettings::default();
    assert!(!s.log_to_file);
  }

  #[test]
  fn app_settings_roundtrip_true() {
    let s = AppSettings { log_to_file: true };
    let json = serde_json::to_string_pretty(&s).unwrap();
    let back: AppSettings = serde_json::from_str(&json).unwrap();
    assert!(back.log_to_file);
  }

  #[test]
  fn app_settings_deserialize_empty_object_uses_default() {
    let s: AppSettings = serde_json::from_str("{}").unwrap();
    assert!(!s.log_to_file);
  }

  #[test]
  fn app_settings_deserialize_malformed_uses_default_in_production() {
    // In read_log_to_file we use unwrap_or_default() for from_str
    let s: AppSettings = serde_json::from_str("{").unwrap_or_default();
    assert!(!s.log_to_file);
  }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())
    .map(|p| p.join(SETTINGS_FILENAME))
}

fn read_log_to_file(app: &tauri::AppHandle) -> bool {
  let path = match settings_path(app) {
    Ok(p) => p,
    Err(_) => return false,
  };
  let contents = match fs::read_to_string(&path) {
    Ok(c) => c,
    Err(_) => return false,
  };
  let settings: AppSettings = serde_json::from_str(&contents).unwrap_or_default();
  settings.log_to_file
}

fn write_log_to_file_setting(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join(SETTINGS_FILENAME);
  let settings = AppSettings { log_to_file: enabled };
  let contents = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
  fs::write(&path, contents).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn get_log_to_file(app: tauri::AppHandle) -> bool {
  read_log_to_file(&app)
}

#[tauri::command]
fn set_log_to_file(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
  write_log_to_file_setting(&app, enabled)?;
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.emit("log-to-file-changed", enabled);
  }
  Ok(())
}

#[tauri::command]
fn append_log_line(app: tauri::AppHandle, level: String, message: String) -> Result<(), String> {
  let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join(LOG_FILENAME);
  let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
  let line = format!("[{}] [{}] {}\n", timestamp, level.to_uppercase(), message);
  let mut f = fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&path)
    .map_err(|e| e.to_string())?;
  f.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
  f.flush().map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      get_log_to_file,
      set_log_to_file,
      append_log_line,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let log_to_file = read_log_to_file(&app.handle());
      let log_to_file_item = CheckMenuItemBuilder::with_id("log-to-file", "Log to file")
        .checked(log_to_file)
        .build(app.handle())?;
      let help_submenu =
        SubmenuBuilder::new(app.handle(), "Help")
          .item(&log_to_file_item)
          .build()?;
      let app_submenu = SubmenuBuilder::new(app.handle(), "Agent PM")
        .quit()
        .build()?;
      let copy_item =
        MenuItemBuilder::with_id("edit-copy", "Copy").accelerator("CmdOrControl+C").build(app.handle())?;
      let cut_item =
        MenuItemBuilder::with_id("edit-cut", "Cut").accelerator("CmdOrControl+X").build(app.handle())?;
      let paste_item =
        MenuItemBuilder::with_id("edit-paste", "Paste").accelerator("CmdOrControl+V").build(app.handle())?;
      let edit_submenu =
        SubmenuBuilder::new(app.handle(), "Edit")
          .item(&copy_item)
          .item(&cut_item)
          .item(&paste_item)
          .build()?;
      let select_all_item =
        MenuItemBuilder::with_id("select-all", "Select All").accelerator("CmdOrControl+A").build(app.handle())?;
      let selection_submenu =
        SubmenuBuilder::new(app.handle(), "Selection")
          .item(&select_all_item)
          .build()?;
      let refresh =
        MenuItemBuilder::with_id("refresh-app", "Refresh App").build(app.handle())?;
      let window_submenu =
        SubmenuBuilder::new(app.handle(), "Window").item(&refresh).build()?;
      let menu = MenuBuilder::new(app.handle())
        .item(&app_submenu)
        .item(&edit_submenu)
        .item(&selection_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()?;
      app.set_menu(menu)?;
      let handle = app.handle().clone();
      app.run_on_main_thread(move || {
        if let Some(w) = handle.get_webview_window("main") {
          if let Ok(Some(monitor)) = handle.primary_monitor() {
            let scale = monitor.scale_factor();
            let physical = monitor.size();
            let logical_w = physical.width as f64 / scale;
            let logical_h = physical.height as f64 / scale;
            let target_w = (logical_w * 0.75).round().max(400.0);
            let target_h = (logical_h * 0.75).round().max(300.0);
            let _ = w.set_size(LogicalSize::new(target_w, target_h));
            let _ = w.center();
          }
        }
      })?;
      Ok(())
    })
    .on_menu_event(|app, event| {
      let id = event.id().as_ref();
      if id == "refresh-app" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("window.location.reload()");
        }
      } else if id == "edit-copy" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("document.execCommand('copy')");
        }
      } else if id == "edit-cut" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("document.execCommand('cut')");
        }
      } else if id == "edit-paste" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("document.execCommand('paste')");
        }
      } else if id == "select-all" {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.eval("document.execCommand('selectAll')");
        }
      } else if id == "log-to-file" {
        let current = read_log_to_file(app);
        let next = !current;
        if write_log_to_file_setting(app, next).is_ok() {
          if let Some(w) = app.get_webview_window("main") {
            let _ = w.emit("log-to-file-changed", next);
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
