
import {
  signFileHash,
  verifyFileSignature,
} from "./digitalSignatureService";

async function testDigitalSignature() {
  try {
    const originalHash = "abc123testhash";
    const studentEmail = "signature-test@example.com";

    // Generate a signature for the test hash.
    const result = await signFileHash(
      originalHash,
      studentEmail
    );

    // Verify the original hash.
    const valid = await verifyFileSignature(
      originalHash,
      result.signature,
      result.publicKey
    );

    // Try verifying a changed hash.
    const invalid = await verifyFileSignature(
      "changed-hash",
      result.signature,
      result.publicKey
    );

    console.log("Original hash verification:", valid);
    console.log("Changed hash verification:", invalid);

    if (valid === true && invalid === false) {
      console.log("SUCCESS: Digital signature test passed!");
    } else {
      console.error("FAILED: Digital signature test did not pass.");
    }
  } catch (error) {
    console.error("Digital signature test error:", error);
  }
}

testDigitalSignature();
