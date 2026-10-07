// Частота запросов: какой счётчик тратит запрос и ответ `429` с CORS как у обычного ответа.
// Сам счётчик — привязка Cloudflare в адаптере `worker`, её проверяет тест в workerd.

use elevation_core::http::{RateGroup, Request, rate_group, too_many_requests};

const CLONE: &str = "https://nakarte-routing.pages.dev";

fn request<'a>(method: &'a str, path: &'a str, origin: Option<&'a str>) -> Request<'a> {
    Request {
        method,
        path,
        origin,
        content_length: None,
        request_headers: None,
        body: b"",
    }
}

#[test]
fn tiles_and_api_spend_separate_counters() {
    let allowed = [CLONE];
    assert_eq!(
        rate_group(&request("GET", "/tiles/11/1277/754", None), &allowed),
        Some(RateGroup::Tiles)
    );
    assert_eq!(
        rate_group(
            &request("GET", "/tiles/x", Some("https://example.com")),
            &allowed
        ),
        Some(RateGroup::Tiles)
    );
    assert_eq!(
        rate_group(&request("POST", "/", Some(CLONE)), &allowed),
        Some(RateGroup::Api)
    );
}

#[test]
fn api_requests_that_get_403_do_not_spend_the_counter() {
    let allowed = [CLONE];
    assert_eq!(rate_group(&request("POST", "/", None), &allowed), None);
    assert_eq!(
        rate_group(&request("POST", "/", Some("https://example.com")), &allowed),
        None
    );
}

#[test]
fn too_many_requests_keeps_the_cors_of_each_route() {
    let tiles = too_many_requests(&request("GET", "/tiles/11/1277/754", Some(CLONE)));
    assert_eq!(tiles.status, 429);
    assert_eq!(tiles.body, b"Too many requests\n");
    assert_eq!(tiles.header("Retry-After"), Some("60"));
    assert_eq!(tiles.header("Access-Control-Allow-Origin"), Some("*"));
    assert_eq!(tiles.header("Access-Control-Allow-Credentials"), None);

    let api = too_many_requests(&request("POST", "/", Some(CLONE)));
    assert_eq!(api.status, 429);
    assert_eq!(api.header("Retry-After"), Some("60"));
    assert_eq!(api.header("Access-Control-Allow-Origin"), Some(CLONE));
    assert_eq!(api.header("Access-Control-Allow-Credentials"), Some("true"));
}
