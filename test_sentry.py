import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# Initialize Sentry with your DSN
sentry_sdk.init(
    dsn="https://962693d042f18049bc26bee0c31c54fd@o4510070455992320.ingest.us.sentry.io/4510088885239808",
    traces_sample_rate=1.0,
    send_default_pii=True,
    integrations=[FlaskIntegration()],
)

print("Testing Sentry integration...")

# Test 1: Capture a message
sentry_sdk.capture_message("Hello from RedsRacing test!", level="info")
print("✓ Message sent to Sentry")

# Test 2: Create a transaction
with sentry_sdk.start_transaction(name="test-transaction", op="test"):
    print("✓ Transaction created")
    
    # Test 3: Force an error
    try:
        result = 1 / 0  # This will cause a ZeroDivisionError
    except Exception as e:
        sentry_sdk.capture_exception(e)
        print("✓ Exception sent to Sentry")

print("All tests completed. Check your Sentry dashboard!")