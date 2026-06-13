use tauri::State;

use crate::AppState;

/// The persistent device id generated on first launch.
#[tauri::command]
pub fn get_device_id(state: State<AppState>) -> String {
    state.device_id.clone()
}
