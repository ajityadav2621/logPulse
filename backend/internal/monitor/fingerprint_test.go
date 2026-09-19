package monitor

import "testing"

func TestFingerprintCollapsesVariableParts(t *testing.T) {
	variants := []string{
		"Failed to charge card order=ORD-10293 user=882",
		"Failed to charge card order=ORD-55121 user=102",
		"failed to charge card order=7 user=9",
	}
	want, _ := Fingerprint(variants[0])
	for _, v := range variants[1:] {
		got, pattern := Fingerprint(v)
		if got != want {
			t.Errorf("variant %q hashed to %s (pattern %q), want %s", v, got, pattern, want)
		}
	}
}

func TestFingerprintSeparatesDistinctModes(t *testing.T) {
	a, _ := Fingerprint("connection refused to database")
	b, _ := Fingerprint("timeout while reading response")
	if a == b {
		t.Error("distinct failure modes must not share a pattern hash")
	}
}

func TestFingerprintMasksIDsAndIPs(t *testing.T) {
	_, pattern := Fingerprint("request 550e8400-e29b-41d4-a716-446655440000 from 10.0.3.7 took 240ms")
	for _, want := range []string{"<uuid>", "<ip>", "<num>"} {
		if !contains(pattern, want) {
			t.Errorf("pattern %q missing %s", pattern, want)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
