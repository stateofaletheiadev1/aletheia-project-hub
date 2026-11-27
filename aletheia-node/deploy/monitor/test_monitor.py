"""Tests for the monitor's decisions: python3 -m unittest deploy/monitor/test_monitor.py"""

import unittest

from aletheia_monitor import (
    MISSED_WINDOW_BLOCKS,
    REMIND_SECONDS,
    STALL_SECONDS,
    Reading,
    evaluate,
    transitions,
)


def healthy(now: float, height: int, **extra) -> Reading:
    reading = Reading(
        now=now,
        height=height,
        peers=0,
        services={"aletheiad": True, "nginx": True},
        node_age_seconds=3600,
        disk_percent=30.0,
        memory_available_mb=300,
        swap_used_percent=10.0,
    )
    for name, value in extra.items():
        setattr(reading, name, value)
    return reading


class Blocks(unittest.TestCase):
    def test_a_rising_height_is_healthy_and_a_stall_alerts_after_two_minutes(self):
        alerts, state, _ = evaluate(healthy(1000, 50), {})
        self.assertEqual(alerts, {})
        alerts, state, _ = evaluate(healthy(1000 + STALL_SECONDS - 1, 50), state)
        self.assertNotIn("stalled", alerts)
        alerts, state, _ = evaluate(healthy(1000 + STALL_SECONDS, 50), state)
        self.assertIn("stalled", alerts)
        alerts, _, _ = evaluate(healthy(1000 + STALL_SECONDS + 1, 51), state)
        self.assertNotIn("stalled", alerts)

    def test_a_node_opening_its_store_is_not_judged(self):
        state = {"height": 50, "height_since": 0}
        alerts, _, _ = evaluate(healthy(10_000, 50, node_age_seconds=60), state)
        self.assertEqual(alerts, {})
        alerts, _, _ = evaluate(healthy(10_000, None, node_age_seconds=60), state)
        self.assertNotIn("rpc", alerts)
        alerts, _, _ = evaluate(healthy(10_000, None, node_age_seconds=3600), state)
        self.assertIn("rpc", alerts)


class Host(unittest.TestCase):
    def test_services_disk_memory_public_and_tls(self):
        reading = healthy(
            1,
            5,
            services={"aletheiad": True, "aletheia-explorer": False},
            disk_percent=90.0,
            memory_available_mb=50,
            swap_used_percent=90.0,
            public={"https://rpc.example": False},
            tls_days={"rpc.example": 3.0},
        )
        alerts, _, _ = evaluate(reading, {})
        self.assertEqual(
            sorted(alerts),
            ["disk", "memory", "public:https://rpc.example", "service:aletheia-explorer", "tls:rpc.example"],
        )

    def test_low_memory_alone_is_not_an_alert_while_swap_has_room(self):
        alerts, _, _ = evaluate(healthy(1, 5, memory_available_mb=40, swap_used_percent=20.0), {})
        self.assertNotIn("memory", alerts)


def validator(index, key, missed):
    return {"index": index, "nodeKey": key, "work": {"credit": "0", "missed": str(missed)}}


class Validators(unittest.TestCase):
    def test_set_changes_are_noticed(self):
        _, state, notices = evaluate(healthy(1, 5, validators=[validator(0, "aa", 0)]), {})
        self.assertEqual(notices, [])
        _, _, notices = evaluate(
            healthy(2, 6, validators=[validator(0, "aa", 0), validator(1, "bb", 0)]), state
        )
        self.assertEqual(len(notices), 1)
        self.assertIn("Joined: bb", notices[0])

    def test_a_validator_missing_over_a_fifth_of_its_signatures_alerts(self):
        _, state, _ = evaluate(healthy(1, 1000, validators=[validator(1, "bb", 0)]), {})
        quarter = MISSED_WINDOW_BLOCKS // 4
        alerts, state, _ = evaluate(
            healthy(2, 1000 + quarter, validators=[validator(1, "bb", quarter // 10)]), state
        )
        self.assertNotIn("missing:bb", alerts)
        alerts, _, _ = evaluate(
            healthy(3, 1000 + quarter, validators=[validator(1, "bb", quarter // 2)]), state
        )
        self.assertIn("missing:bb", alerts)

    def test_validators_without_peers_alert(self):
        alerts, _, _ = evaluate(
            healthy(1, 5, peers=0, validators=[validator(0, "aa", 0), validator(1, "bb", 0)]), {}
        )
        self.assertIn("peers", alerts)


class Mail(unittest.TestCase):
    def test_an_alert_is_sent_when_it_starts_reminded_and_cleared(self):
        messages, known = transitions({"disk": "full"}, {}, 0)
        self.assertEqual(messages, ["ALERT: full"])
        messages, known = transitions({"disk": "full"}, {"alerts": known}, 60)
        self.assertEqual(messages, [])
        messages, known = transitions({"disk": "full"}, {"alerts": known}, REMIND_SECONDS)
        self.assertEqual(len(messages), 1)
        self.assertTrue(messages[0].startswith("STILL ACTIVE"))
        messages, known = transitions({}, {"alerts": known}, REMIND_SECONDS + 60)
        self.assertEqual(messages, ["CLEARED: full"])
        self.assertEqual(known, {})


if __name__ == "__main__":
    unittest.main()
