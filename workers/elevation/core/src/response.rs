// Автор пишет `round(v * 100)` (округление от нуля, `math.Round`) и ставит точку перед двумя
// последними цифрами. `format!("{:.2}")` округляет иначе, поэтому вручную.
pub fn format_elevation(elevation: Option<f64>) -> String {
    let Some(elevation) = elevation else {
        return "NULL".to_string();
    };
    let hundredths = (elevation * 100.0).round() as i64;
    let sign = if hundredths < 0 { "-" } else { "" };
    let magnitude = hundredths.unsigned_abs();
    format!("{sign}{}.{:02}", magnitude / 100, magnitude % 100)
}

pub fn format_elevations(elevations: &[Option<f64>]) -> String {
    elevations
        .iter()
        .map(|&elevation| format_elevation(elevation))
        .collect::<Vec<_>>()
        .join("\n")
}
