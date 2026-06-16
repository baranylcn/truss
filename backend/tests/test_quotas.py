from app.services.quotas import storage_would_exceed

MB = 1024 * 1024


def test_under_limit_is_allowed():
    assert storage_would_exceed(0, 5 * MB, 10) is False


def test_exactly_at_limit_is_allowed():
    assert storage_would_exceed(0, 10 * MB, 10) is False


def test_incoming_pushes_over_limit():
    assert storage_would_exceed(9 * MB, 2 * MB, 10) is True


def test_existing_usage_counts_toward_limit():
    assert storage_would_exceed(10 * MB, 1, 10) is True
