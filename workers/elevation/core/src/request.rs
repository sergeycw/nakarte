// Разбор повторяет Go-сервер автора: строки по `\n`, один хвостовой `\n` допустим, широта и долгота
// через первый пробел, числа как `strconv.ParseFloat` (`1e1`, `nan` проходят). Пустая строка в
// середине, лишний пробел, `\r` — `400`. Лимиты автора: 250 000 байт и 10 000 точек, иначе `413`.
// Расхождение с Go: шестнадцатеричные числа и `_` в числах Rust не разбирает, клиент их не шлёт.
pub const MAX_BODY_BYTES: usize = 250_000;
pub const MAX_POINTS: usize = 10_000;
// Свой лимит, у автора его нет: точки, задевающие больше чтений хранилища (градусы + куски, `read_count`),
// получают тот же `413`. Точки вдоль трека в 5 000 км задевают ≈ 450 кусков, 10 000 точек вразброс —
// до 20 000 чтений класса B R2 (security-аудит, п. 2; change limit-elevation-reads).
pub const MAX_READS: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseError {
    Invalid,
    TooBig,
}

pub fn parse_points(body: &[u8]) -> Result<Vec<(f64, f64)>, ParseError> {
    if body.len() > MAX_BODY_BYTES {
        return Err(ParseError::TooBig);
    }
    let mut points = Vec::new();
    let mut lines = body.split(|&byte| byte == b'\n').peekable();
    while let Some(line) = lines.next() {
        if line.is_empty() && lines.peek().is_none() {
            break;
        }
        points.push(parse_line(line)?);
        if points.len() > MAX_POINTS {
            return Err(ParseError::TooBig);
        }
    }
    Ok(points)
}

fn parse_line(line: &[u8]) -> Result<(f64, f64), ParseError> {
    let space = line
        .iter()
        .position(|&byte| byte == b' ')
        .ok_or(ParseError::Invalid)?;
    let lat = parse_number(&line[..space])?;
    let lon = parse_number(&line[space + 1..])?;
    Ok((lat, lon))
}

fn parse_number(text: &[u8]) -> Result<f64, ParseError> {
    std::str::from_utf8(text)
        .ok()
        .and_then(|text| text.parse::<f64>().ok())
        .ok_or(ParseError::Invalid)
}
