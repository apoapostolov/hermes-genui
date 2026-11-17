import importlib
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
track = importlib.import_module("hermes_genui.core.assistant.track")

TODAY = date(2026, 11, 16)
NOW = datetime(2026, 11, 16, 9, 0, tzinfo=ZoneInfo("America/Los_Angeles"))


def item(**kw):
    return {"id": kw.pop("id", "i1"), "ref": "r", "pile": "bills", "title": "Bill", "status": "suggested", **kw}


def test_overdue_from_local_date():
    assert track.state(item(due="2026-11-15"), TODAY) == ("overdue", "Overdue · 1 day")
    assert track.state(item(due="2026-11-13"), TODAY) == ("overdue", "Overdue · 3 days")


def test_soon_and_today_and_later():
    assert track.state(item(due="2026-11-16"), TODAY) == ("today", "Due today")
    assert track.state(item(due="2026-11-19"), TODAY) == ("soon", "In 3 days")
    assert track.state(item(due="2026-11-17"), TODAY) == ("soon", "Tomorrow")
    assert track.state(item(due="2026-11-24"), TODAY) == ("open", "Due 24 Nov")
    assert track.state(item(), TODAY) == ("open", "")


def test_renewals_turn_red_too():
    assert track.state(item(pile="renewals", due="2026-11-15"), TODAY)[0] == "overdue"


def test_past_event_or_order_is_done_not_overdue():
    assert track.state(item(pile="events", due="2026-11-15"), TODAY) == ("done", "")
    assert track.state(item(pile="orders", due="2026-11-15"), TODAY) == ("done", "")


def test_reply_past_due_is_late():
    assert track.state(item(pile="replies", due="2026-11-14"), TODAY) == ("overdue", "Late · 2 days")


def test_arriving_today_uses_the_detail():
    order = item(pile="orders", due="2026-11-16", detail="Arriving today · code 4821 for the driver")
    assert track.state(order, TODAY) == ("today", "Arriving today · code 4821 for the driver")


def test_fake_alert():
    assert track.state(item(pile="alerts", flag="fake"), TODAY) == ("overdue", "⚠ Looks fake · look-alike sender")


def test_closed_by_the_check_is_handled_for_three_days():
    paid = item(status="done", closed_verb="Paid", closed_why="confirmation mail 16 Nov",
                closed_at="2026-11-16T08:00:00-08:00")
    assert track.state(paid, TODAY) == ("handled", "Paid")
    old = {**paid, "closed_at": "2026-11-12T08:00:00-08:00"}
    assert track.state(old, TODAY) == ("done", "")
    by_user = item(status="done")
    assert track.state(by_user, TODAY) == ("done", "")


def test_needs_you_order():
    items = [
        item(id="xf", title="Xfinity", due="2026-11-19"),
        item(id="tg", pile="orders", title="Target pickup", due="2026-11-16"),
        item(id="cl", title="City Light", due="2026-11-15"),
        item(id="ship", pile="orders", title="Headphones", due="2026-11-18", taken="Following your order"),
        item(id="tax", title="Q4 tax", due="2027-01-15"),
        item(id="mom", pile="replies", title="Mom"),
        item(id="fake", pile="alerts", flag="fake", title="Fake mail"),
        item(id="done", status="done", title="Paid one"),
    ]
    assert [i["id"] for i in track.needs_you(items, TODAY)] == ["cl", "fake", "tg", "xf", "mom"]


def test_handled_never_empty_after_first_check():
    rows = track.handled([item(id="o", pile="orders", taken="Following your Amazon order")], NOW)
    assert rows == [{"id": "o", "title": "Bill", "kind": "tracking", "verb": "Tracking",
                     "why": "Following your Amazon order", "reopen": False}]


def test_handled_order_closed_protected_tracking():
    items = [
        item(id="t", pile="orders", taken="Following your order", due="2026-11-20"),
        item(id="f", pile="alerts", flag="fake", title="Fake"),
        item(id="p", status="done", amount="$89.98", closed_verb="Paid", closed_why="confirmation mail 16 Nov",
             closed_at="2026-11-16T08:00:00-08:00"),
    ]
    rows = track.handled(items, NOW)
    assert [(r["id"], r["kind"], r["verb"]) for r in rows] == [
        ("p", "closed", "Paid"), ("f", "protected", "Protected you"), ("t", "tracking", "Tracking")]
    assert rows[0]["reopen"] is True and rows[0]["amount"] == "$89.98"


def test_handled_skips_needs_you_items_and_old_closes():
    items = [item(id="cl", due="2026-11-15", taken="Noted the due date"),
             item(id="old", status="done", closed_verb="Paid", closed_why="x",
                  closed_at=(NOW - timedelta(days=4)).isoformat())]
    assert track.handled(items, NOW) == []


def test_handled_at_most_six():
    items = [item(id=f"o{n}", pile="orders", taken="Following") for n in range(9)]
    assert len(track.handled(items, NOW)) == track.HANDLED_MAX == 6


def test_counts():
    items = [item(id="cl", due="2026-11-15"), item(id="o", pile="orders", taken="Following")]
    assert track.counts(items, NOW) == {"overdue": 1, "need": 1, "handled": 1}


def test_sender_domain():
    assert track.sender_domain("Seattle City Light <billing@citylight.example>") == "citylight.example"
    assert track.sender_domain("no-reply@Pay.DOL.wa.example") == "wa.example"
    assert track.sender_domain("nobody") is None


def test_same_site():
    assert track.same_site("https://www.citylight.example/pay", "citylight.example")
    assert not track.same_site("https://citylight.example.evil.example/pay", "citylight.example")
    assert not track.same_site("https://citylight-billing.example/", "citylight.example")
    assert not track.same_site("http://citylight.example/", "citylight.example")
    assert track.same_site("https://pay.dol.wa.example/x", "dol.wa.example")
    assert track.same_site("https://www.bank.co.uk/pay", "bank.co.uk")
    assert not track.same_site("https://evil.co.uk/pay", "bank.co.uk")


def test_counts_leave_fake_mail_out_of_overdue():
    items = [item(id="cl", due="2026-11-15"), item(id="f", pile="alerts", flag="fake")]
    assert track.counts(items, NOW) == {"overdue": 1, "need": 2, "handled": 1}


def test_an_order_due_today_is_arriving():
    assert track.state(item(pile="orders", due="2026-11-16", detail="Out for delivery by 8 PM"), TODAY) == (
        "today", "Arriving today")


def test_parser_tricks_never_pass_the_site_check():
    for url in ("https://evil.example\\@citylight.example/pay", "https://evil.example\\.citylight.example/pay",
                "https://evil.example @citylight.example/", "https://user@citylight.example/pay",
                "https://citylight.example\t/pay", "https://citylÿght.example/"):
        assert not track.same_site(url, "citylight.example"), url
        assert track.safe_url(url) is None, url
    assert track.safe_url(" https://www.citylight.example/pay?x=1 ") == "https://www.citylight.example/pay?x=1"


def test_stale_items_are_not_tracking_rows():
    old = [item(id="d", pile="events", due="2026-11-09", taken="Noted"), item(id="o", pile="orders",
                                                                         due="2026-11-10", taken="Following")]
    assert track.handled(old, NOW) == []
