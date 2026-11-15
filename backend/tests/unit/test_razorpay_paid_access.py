from src.config import Config
from src.services.billing_service import grants_paid_access


def test_razorpay_retrying_renewal_keeps_access():
    # Razorpay's "pending" (retrying a failed renewal) is stored as past_due.
    assert grants_paid_access("pro", "past_due", "razorpay")
    assert grants_paid_access("pro", "past_due", "stripe")
    assert not grants_paid_access("pro", "past_due", "apple")
    assert not grants_paid_access("pro", "inactive", "razorpay")


def test_razorpay_past_due_keeps_youtube_duration_cap():
    config = Config()
    assert config.max_youtube_video_duration_for_plan(
        "pro", "past_due", "razorpay"
    ) == config.pro_youtube_max_video_duration
    assert config.max_youtube_video_duration_for_plan(
        "pro", "past_due", "apple"
    ) == config.max_video_duration
