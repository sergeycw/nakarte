// Частота запросов: тратит ли запрос счётчик и ответ `429` с CORS как у обычного ответа API.
// Сам счётчик — привязка Cloudflare в адаптере `worker`, её проверяет тест в workerd.

use elevation_core::http::{Request, Unlimited, counts_toward_limit, handle, too_many_requests};
use elevation_core::{Error, Source};
use futures::executor::block_on;

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
fn api_requests_from_allowed_origin_spend_the_counter() {
    let allowed = [CLONE];
    assert!(counts_toward_limit(
        &request("POST", "/", Some(CLONE)),
        &allowed
    ));
}

#[test]
fn api_requests_that_get_403_do_not_spend_the_counter() {
    let allowed = [CLONE];
    assert!(!counts_toward_limit(&request("POST", "/", None), &allowed));
    assert!(!counts_toward_limit(
        &request("POST", "/", Some("https://example.com")),
        &allowed
    ));
    // бывший маршрут тайлов высот без `Origin` своего счётчика больше не тратит
    assert!(!counts_toward_limit(
        &request("GET", "/tiles/11/1277/754", None),
        &allowed
    ));
}

#[test]
fn too_many_requests_keeps_the_cors_of_the_api() {
    let api = too_many_requests(CLONE);
    assert_eq!(api.status, 429);
    assert_eq!(api.body, b"Too many requests\n");
    assert_eq!(api.header("Retry-After"), Some("60"));
    assert_eq!(api.header("Access-Control-Allow-Origin"), Some(CLONE));
    assert_eq!(api.header("Access-Control-Allow-Credentials"), Some("true"));
}

// Маршрута тайлов высот нет (change retire-old-client-services): `/tiles/…` — обычный запрос API.
struct NoData;

impl Source for NoData {
    async fn read(&self, _key: &str, _offset: u64, _length: u64) -> Result<Option<Vec<u8>>, Error> {
        Ok(None)
    }
}

#[test]
fn former_tiles_route_is_an_api_request() {
    let without_origin = block_on(handle(
        &request("GET", "/tiles/0/0/0", None),
        &[CLONE],
        &NoData,
        &Unlimited,
    ));
    assert_eq!(without_origin.status, 403);
    assert_eq!(without_origin.header("Access-Control-Allow-Origin"), None);
    let with_origin = block_on(handle(
        &request("GET", "/tiles/0/0/0", Some(CLONE)),
        &[CLONE],
        &NoData,
        &Unlimited,
    ));
    assert_eq!(with_origin.status, 405);
}

// Цена запроса API — чтения хранилища: потолок `MAX_READS` на запрос и бюджет клиента
// (`ReadBudget`, в `worker` — привязка по IP).

mod reads {
    use std::cell::{Cell, RefCell};

    use elevation_core::http::{ReadBudget, Request, Unlimited, handle};
    use elevation_core::request::MAX_READS;
    use elevation_core::{Error, Source, read_count};
    use futures::executor::block_on;

    use super::CLONE;

    #[derive(Default)]
    struct CountingSource {
        reads: Cell<usize>,
    }

    impl Source for CountingSource {
        async fn read(
            &self,
            _key: &str,
            _offset: u64,
            _length: u64,
        ) -> Result<Option<Vec<u8>>, Error> {
            self.reads.set(self.reads.get() + 1);
            Ok(None)
        }
    }

    // Запоминает, сколько единиц просили, и отвечает заданным решением.
    struct FixedBudget {
        allow: bool,
        spent: RefCell<Vec<usize>>,
    }

    impl ReadBudget for FixedBudget {
        async fn spend(&self, units: usize) -> bool {
            self.spent.borrow_mut().push(units);
            self.allow
        }
    }

    fn budget(allow: bool) -> FixedBudget {
        FixedBudget {
            allow,
            spent: RefCell::new(Vec::new()),
        }
    }

    fn body(points: &[(f64, f64)]) -> Vec<u8> {
        points
            .iter()
            .map(|(lat, lon)| format!("{lat:.6} {lon:.6}\n"))
            .collect::<String>()
            .into_bytes()
    }

    fn post<B: ReadBudget>(
        source: &CountingSource,
        body: &[u8],
        budget: &B,
    ) -> elevation_core::http::Response {
        let request = Request {
            method: "POST",
            path: "/",
            origin: Some(CLONE),
            content_length: Some(body.len() as u64),
            request_headers: None,
            body,
        };
        block_on(handle(&request, &[CLONE], source, budget))
    }

    // 600 точек в 600 разных градусах: 600 заголовков + 600 кусков.
    fn scattered() -> Vec<(f64, f64)> {
        (0..600)
            .map(|i| ((i % 100) as f64 - 49.5, (i / 100) as f64 * 10.0 + 0.5))
            .collect()
    }

    // 9 999 точек по меридиану 42.5° от 30° до 48° с. ш. (≈ 2 000 км): 18 градусов, 72 куска.
    fn long_track() -> Vec<(f64, f64)> {
        (0..9_999)
            .map(|i| (30.0 + 18.0 * i as f64 / 9_999.0, 42.5))
            .collect()
    }

    #[test]
    fn read_count_is_degrees_plus_chunks() {
        assert_eq!(read_count(&[]), 0);
        assert_eq!(read_count(&[(95.0, 0.0)]), 0);
        // один кусок: заголовок + кусок, сколько бы точек в нём ни было
        assert_eq!(read_count(&[(43.1, 42.1), (43.2, 42.2)]), 2);
        // два куска одного градуса: заголовок + 2 куска
        assert_eq!(read_count(&[(43.1, 42.1), (43.9, 42.9)]), 3);
        assert_eq!(read_count(&scattered()), 1_200);
        assert_eq!(read_count(&long_track()), 18 + 72);
    }

    #[test]
    fn scattered_points_get_413_without_reading() {
        let source = CountingSource::default();
        let spender = budget(true);
        let response = post(&source, &body(&scattered()), &spender);
        assert_eq!(response.status, 413);
        assert_eq!(response.body, b"Request too big\n");
        assert_eq!(response.header("Access-Control-Allow-Origin"), Some(CLONE));
        assert_eq!(source.reads.get(), 0);
        assert!(spender.spent.borrow().is_empty());
    }

    #[test]
    fn long_track_fits_and_spends_units_by_reads() {
        assert!(read_count(&long_track()) <= MAX_READS);
        let source = CountingSource::default();
        let spender = budget(true);
        let response = post(&source, &body(&long_track()), &spender);
        assert_eq!(response.status, 200);
        // 90 чтений → 2 единицы по 64
        assert_eq!(*spender.spent.borrow(), vec![2]);
    }

    #[test]
    fn exhausted_budget_gives_429_with_cors_and_no_reads() {
        let source = CountingSource::default();
        let response = post(&source, &body(&long_track()), &budget(false));
        assert_eq!(response.status, 429);
        assert_eq!(response.body, b"Too many requests\n");
        assert_eq!(response.header("Retry-After"), Some("60"));
        assert_eq!(response.header("Access-Control-Allow-Origin"), Some(CLONE));
        assert_eq!(
            response.header("Access-Control-Allow-Credentials"),
            Some("true")
        );
        assert_eq!(source.reads.get(), 0);
    }

    #[test]
    fn request_without_reads_does_not_spend_the_budget() {
        let source = CountingSource::default();
        let spender = budget(false);
        let response = post(&source, b"95 0\n", &spender);
        assert_eq!(response.status, 200);
        assert_eq!(response.body, b"NULL");
        assert!(spender.spent.borrow().is_empty());
        let response = post(&source, b"", &Unlimited);
        assert_eq!(response.status, 200);
    }
}
