from app.core.auth import hash_password, verify_password


def test_hash_is_not_plaintext():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"


def test_verify_correct_password():
    hashed = hash_password("correct")
    assert verify_password("correct", hashed) is True


def test_verify_wrong_password():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_same_password_produces_different_hashes():
    h1 = hash_password("password")
    h2 = hash_password("password")
    assert h1 != h2


def test_verify_is_consistent_across_hashes():
    plain = "consistent"
    h1 = hash_password(plain)
    h2 = hash_password(plain)
    assert verify_password(plain, h1) is True
    assert verify_password(plain, h2) is True
