import importlib
import json
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
memory = importlib.import_module("hermes_genui.core.assistant.memory")

NOW = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
AIRTEL = {"ref": "airtel-bill-20261113", "pile": "bills", "title": "Airtel ₹1,178 due Tue 17 Nov",
          "detail": "Xstream Fiber, November", "due": "2026-11-17", "amount": "₹1,178",
          "suggestion": "Pay the Airtel bill of ₹1,178"}
ORDER = {"ref": "amazon-placed-20261113", "pile": "orders", "title": "Sony WH-1000XM6 headphones",
         "detail": "Arriving Sat 14 Nov", "taken": "Started following the order"}


def root(tmp_path):
    return tmp_path / "blocks"


def test_a_new_report_files_items_and_logs_the_check(tmp_path):
    reply = memory.apply_report({"items": [AIRTEL, ORDER], "summary": "2 new"}, NOW, root(tmp_path))
    assert reply.startswith("Recorded: 2 new, 0 updated, 0 closed.")
    items = memory.load_items(root(tmp_path))
    assert [i["status"] for i in items] == ["suggested", "suggested"]
    assert all(len(i["id"]) == 8 and i["history"] for i in items)
    checks = json.loads((memory.assistant_dir(root(tmp_path)) / "checks.json").read_text())
    assert checks[-1]["new"] == 2 and checks[-1]["summary"] == "2 new"
    assert memory.load_config(root(tmp_path))["last_check"] == NOW.isoformat()


def test_the_same_report_twice_updates_instead_of_duplicating(tmp_path):
    memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    reply = memory.apply_report({"items": [{**AIRTEL, "detail": "Reminder sent"}], "summary": ""}, NOW,
                                root(tmp_path))
    assert reply.startswith("Recorded: 0 new, 1 updated, 0 closed.")
    items = memory.load_items(root(tmp_path))
    assert len(items) == 1 and items[0]["detail"] == "Reminder sent"


def test_a_dismissed_item_stays_dismissed_and_is_named(tmp_path):
    memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    item = memory.load_items(root(tmp_path))[0]
    memory.set_status(item["id"], "dismissed", NOW, "page", root(tmp_path))
    reply = memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    assert "Left alone (dismissed): Airtel ₹1,178 due Tue 17 Nov." in reply
    assert memory.load_items(root(tmp_path))[0]["status"] == "dismissed"


def test_done_in_a_report_closes_the_item(tmp_path):
    memory.apply_report({"items": [ORDER], "summary": ""}, NOW, root(tmp_path))
    reply = memory.apply_report({"items": [{**ORDER, "status": "done", "verb": "Delivered", "why": "6:45 PM, porch"}],
                                 "summary": ""}, NOW, root(tmp_path))
    assert "1 closed" in reply
    item = memory.load_items(root(tmp_path))[0]
    assert item["status"] == "done" and item["closed_verb"] == "Delivered" and item["closed_why"] == "6:45 PM, porch"


def test_a_bad_item_is_skipped_the_rest_recorded_and_long_text_is_trimmed(tmp_path):
    reply = memory.apply_report({"items": [AIRTEL, {"pile": "spam", "title": "x"}], "summary": ""}, NOW,
                                root(tmp_path))
    assert reply.startswith("Recorded: 1 new")
    assert "items.1: unknown pile 'spam'" in reply and "items.1: needs a ref" in reply
    assert [i["ref"] for i in memory.load_items(root(tmp_path))] == [AIRTEL["ref"]]
    memory.apply_report({"items": [{**AIRTEL, "ref": "other", "title": "x" * 2000}], "summary": ""}, NOW,
                        root(tmp_path))
    assert len(memory.load_items(root(tmp_path))[1]["title"]) == memory.TITLE_MAX


def test_a_report_that_is_not_a_report_is_refused(tmp_path):
    assert memory.apply_report({"items": "nope"}, NOW, root(tmp_path)).startswith("Not recorded")


def test_set_status_records_who_and_returns_the_item(tmp_path):
    memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    item = memory.set_status(item_id, "pending", NOW, "page", root(tmp_path))
    assert item["status"] == "pending" and item["history"][-1]["what"] == "page: pending"
    assert memory.set_status("nope1234", "done", NOW, "page", root(tmp_path)) is None


def test_buttons_racing_a_check_lose_nothing(tmp_path):
    memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    reports = [{"items": [{**ORDER, "ref": f"order-{n}"}], "summary": ""} for n in range(20)]
    threads = [threading.Thread(target=memory.apply_report, args=(r, NOW, root(tmp_path))) for r in reports]
    threads.append(threading.Thread(target=memory.set_status, args=(item_id, "done", NOW, "page", root(tmp_path))))
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    items = memory.load_items(root(tmp_path))
    assert len(items) == 21
    assert next(i for i in items if i["id"] == item_id)["status"] == "done"


def test_the_check_log_keeps_the_last_fifty(tmp_path):
    for n in range(55):
        memory.apply_report({"items": [], "summary": str(n)}, NOW, root(tmp_path))
    checks = json.loads((memory.assistant_dir(root(tmp_path)) / "checks.json").read_text())
    assert len(checks) == 50 and checks[-1]["summary"] == "54"


def test_config_and_clear(tmp_path):
    assert memory.load_config(root(tmp_path)) == {}
    memory.save_config({"source": "demo", "setup_at": NOW.isoformat(), "last_check": None}, root(tmp_path))
    assert memory.load_config(root(tmp_path))["source"] == "demo"
    memory.clear(root(tmp_path))
    assert memory.load_config(root(tmp_path)) == {} and not memory.assistant_dir(root(tmp_path)).exists()


def _second_copy():
    """memory.py loaded again by path, as the dashboard API does: a separate module with its own globals."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("assistant_memory_copy", memory.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_a_button_from_the_api_copy_racing_the_check_is_not_lost(tmp_path):
    api = _second_copy()
    memory.apply_report({"items": [AIRTEL], "summary": ""}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    reports = [{"items": [{**ORDER, "ref": f"order-{n}"}], "summary": ""} for n in range(30)]
    threads = [threading.Thread(target=memory.apply_report, args=(r, NOW, root(tmp_path))) for r in reports]
    threads.insert(10, threading.Thread(target=api.set_status, args=(item_id, "done", NOW, "page", root(tmp_path))))
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    items = memory.load_items(root(tmp_path))
    assert len(items) == 31
    assert next(i for i in items if i["id"] == item_id)["status"] == "done"


def test_last_check_is_when_the_inbox_was_read_not_when_the_report_came(tmp_path):
    memory.save_config({"source": "demo", "setup_at": NOW.isoformat(), "last_check": None}, root(tmp_path))
    read_at = NOW.replace(minute=14, second=50)
    memory.note_inbox_read(read_at, root(tmp_path))
    memory.apply_report({"items": [], "summary": ""}, NOW.replace(minute=15, second=30), root(tmp_path))
    assert memory.load_config(root(tmp_path))["last_check"] == read_at.isoformat()


def test_reopen_only_undoes_a_tick_from_the_same_place(tmp_path):
    memory.apply_report({"items": [AIRTEL, ORDER], "summary": ""}, NOW, root(tmp_path))
    a, o = memory.load_items(root(tmp_path))
    memory.set_status(a["id"], "done", NOW, "page", root(tmp_path))
    memory.apply_report({"items": [{**ORDER, "status": "done", "verb": "Delivered", "why": "on the porch"}],
                         "summary": ""}, NOW, root(tmp_path))
    assert memory.reopen(a["id"], NOW, "page", root(tmp_path))["status"] == "suggested"
    assert memory.reopen(o["id"], NOW, "page", root(tmp_path)) is None  # the check closed it: left done
    assert memory.load_items(root(tmp_path))[1]["status"] == "done"


BILL = {"ref": "xf-bill", "pile": "bills", "title": "Xfinity", "due": "2026-11-19", "amount": "$89.98",
        "from": "Xfinity <online.communications@xfinity.example>", "received": "2026-11-14T08:15:00-08:00",
        "facts": ["Amount $89.98", "Due Thu 19 Nov", "Autopay off", "Account 12", "fifth"]}
PAID = {"ref": "xf-bill", "pile": "bills", "title": "Payment received", "status": "done", "verb": "Paid",
        "why": "confirmation mail 16 Nov", "evidence_ref": "xf-paid"}


def test_close_needs_why_and_verb_rest_recorded(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    reply = memory.apply_report({"items": [{**PAID, "why": ""}, ORDER]}, NOW, root(tmp_path))
    assert "items.0: needs verb and why to close" in reply and "1 new" in reply
    items = {i["ref"]: i for i in memory.load_items(root(tmp_path))}
    assert items["xf-bill"]["status"] == "suggested" and ORDER["ref"] in items


def test_close_only_changes_close_fields(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))
    item = memory.load_items(root(tmp_path))[0]
    assert item["title"] == "Xfinity" and item["amount"] == "$89.98" and item["due"] == "2026-11-19"
    assert (item["status"], item["closed_verb"], item["closed_why"], item["evidence_ref"]) == (
        "done", "Paid", "confirmation mail 16 Nov", "xf-paid")
    assert item["closed_at"] == NOW.isoformat()
    assert item["history"][-1]["what"] == "closed: Paid · confirmation mail 16 Nov"


def test_close_unknown_ref_refused(tmp_path):
    reply = memory.apply_report({"items": [{**PAID, "ref": "never"}]}, NOW, root(tmp_path))
    assert "no open item never to close" in reply and memory.load_items(root(tmp_path)) == []


def test_bad_verb_refused(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    assert "needs verb and why to close" in memory.apply_report({"items": [{**PAID, "verb": "Zapped"}]}, NOW,
                                                                  root(tmp_path))


def test_details_fields_kept_and_cut(tmp_path):
    memory.apply_report({"items": [{**BILL, "facts": [*BILL["facts"][:4], "x" * 99], "from": "y" * 300}]}, NOW,
                        root(tmp_path))
    item = memory.load_items(root(tmp_path))[0]
    assert item["facts"] == BILL["facts"][:4] and len(item["from"]) == 120
    memory.apply_report({"items": [{**BILL, "ref": "b2", "facts": ["z" * 99]}]}, NOW, root(tmp_path))
    assert memory.load_items(root(tmp_path))[1]["facts"] == ["z" * memory.FACT_LEN]
    assert memory.load_items(root(tmp_path))[0]["received"] == "2026-11-14T08:15:00-08:00"


def test_fake_flag_kept_other_flags_dropped(tmp_path):
    memory.apply_report({"items": [{**ORDER, "pile": "alerts", "flag": "fake"}, {**BILL, "flag": "vip"}]}, NOW,
                        root(tmp_path))
    flags = [i.get("flag") for i in memory.load_items(root(tmp_path))]
    assert flags == ["fake", None]


def test_prep_words_with_url_or_symbols_dropped(tmp_path):
    bad = ["see https://x.example", "a@b", "x" * 61, "rm -rf /", 'say "hi"']
    memory.apply_report({"items": [{**ORDER, "ref": f"o{n}", "prep": {"kind": "gift", "words": w}}
                                   for n, w in enumerate(bad)]}, NOW, root(tmp_path))
    items = memory.load_items(root(tmp_path))
    assert len(items) == len(bad) and all("prep" not in i for i in items)


def test_prep_kept_and_ideas_needed(tmp_path):
    tagged = {**ORDER, "prep": {"kind": "recipes", "words": "Thanksgiving dinner, turkey"}}
    reply = memory.apply_report({"items": [tagged, {**BILL, "prep": {"kind": "magic", "words": "x"}}]}, NOW,
                                root(tmp_path))
    assert reply.endswith("Ideas needed: 1.")
    items = memory.load_items(root(tmp_path))
    assert items[0]["prep"] == {"kind": "recipes", "words": "Thanksgiving dinner, turkey"} and "prep" not in items[1]
    assert [i["ref"] for i in memory.pending_prep(items)] == [ORDER["ref"]]


def test_set_prep_result_keeps_four_and_marks_done(tmp_path):
    memory.apply_report({"items": [{**ORDER, "prep": {"kind": "gift", "words": "birthday cake"}}]}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    ideas = [{"title": "t" * 50, "note": "n" * 99, "photo": f"https://p.example/{n}.jpg", "junk": 1} for n in range(6)]
    item = memory.set_prep_result(item_id, ideas, "https://pay.example/x", NOW, root(tmp_path))
    assert len(item["ideas"]) == 4 and len(item["ideas"][0]["title"]) == 40 and len(item["ideas"][0]["note"]) == 80
    assert "junk" not in item["ideas"][0] and item["pay_link"] == "https://pay.example/x"
    assert item["prep"]["done_at"] == NOW.isoformat() and memory.pending_prep(memory.load_items(root(tmp_path))) == []


def test_changed_prep_clears_old_ideas(tmp_path):
    memory.apply_report({"items": [{**ORDER, "prep": {"kind": "gift", "words": "cake"}}]}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    memory.set_prep_result(item_id, [{"title": "a", "photo": "https://p.example/a.jpg"}], None, NOW, root(tmp_path))
    memory.apply_report({"items": [{**ORDER, "prep": {"kind": "gift", "words": "cake"}}]}, NOW, root(tmp_path))
    assert memory.load_items(root(tmp_path))[0]["ideas"]  # same tag: ideas stay
    memory.apply_report({"items": [{**ORDER, "prep": {"kind": "gift", "words": "flowers"}}]}, NOW, root(tmp_path))
    item = memory.load_items(root(tmp_path))[0]
    assert "ideas" not in item and "done_at" not in item["prep"]


def test_renewals_pile_accepted(tmp_path):
    assert memory.apply_report({"items": [{**BILL, "pile": "renewals"}]}, NOW, root(tmp_path)).startswith("Recorded: 1")


def test_user_reopen_then_same_evidence_close_refused(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    item = memory.user_reopen(item_id, NOW, root(tmp_path))
    assert item["status"] == "suggested" and item["reopened_by_user"] is True and "closed_verb" not in item
    assert item["history"][-1]["what"] == "you: reopened"
    reply = memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))
    assert "the user reopened this" in reply and memory.load_items(root(tmp_path))[0]["status"] == "suggested"


def test_user_reopen_then_newer_evidence_closes(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))
    memory.user_reopen(memory.load_items(root(tmp_path))[0]["id"], NOW, root(tmp_path))
    memory.apply_report({"items": [{**PAID, "evidence_ref": "xf-paid-2"}]}, NOW, root(tmp_path))
    item = memory.load_items(root(tmp_path))[0]
    assert item["status"] == "done" and item["reopened_by_user"] is False


def test_user_reopen_unknown_is_none(tmp_path):
    assert memory.user_reopen("nope", NOW, root(tmp_path)) is None


def test_ideas_needed_only_for_newly_tagged_items(tmp_path):
    tagged = {**ORDER, "prep": {"kind": "gift", "words": "cake"}}
    assert memory.apply_report({"items": [tagged]}, NOW, root(tmp_path)).endswith("Ideas needed: 1.")
    assert "Ideas needed" not in memory.apply_report({"items": [tagged]}, NOW, root(tmp_path))
    assert "Ideas needed" not in memory.apply_report({"items": []}, NOW, root(tmp_path))


def test_reopened_item_needs_new_evidence_to_close(tmp_path):
    memory.apply_report({"items": [BILL]}, NOW, root(tmp_path))
    memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))
    item_id = memory.load_items(root(tmp_path))[0]["id"]
    memory.user_reopen(item_id, NOW, root(tmp_path))
    no_evidence = {k: v for k, v in PAID.items() if k != "evidence_ref"}
    assert "the user reopened this" in memory.apply_report({"items": [no_evidence]}, NOW, root(tmp_path))
    memory.user_reopen(item_id, NOW, root(tmp_path))  # a second tap keeps what it remembered
    assert memory.load_items(root(tmp_path))[0]["reopen_evidence"] == "xf-paid"
    assert "the user reopened this" in memory.apply_report({"items": [PAID]}, NOW, root(tmp_path))


def test_a_fake_item_is_never_tagged(tmp_path):
    fake = {**ORDER, "pile": "alerts", "flag": "fake", "prep": {"kind": "pay", "words": "City Light"}}
    reply = memory.apply_report({"items": [fake]}, NOW, root(tmp_path))
    assert "Ideas needed" not in reply and "prep" not in memory.load_items(root(tmp_path))[0]
