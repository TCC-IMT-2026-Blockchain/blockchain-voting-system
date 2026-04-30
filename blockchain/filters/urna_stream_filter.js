// MultiChain Stream Filter: validates data published to the "urna" stream.
// It intentionally rejects any identity-bearing fields in vote payloads.

function fail(message) {
  return "urna stream item rejected: " + message;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function hasKey(keys, expected) {
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === expected) {
      return true;
    }
  }
  return false;
}

function filterstreamitem() {
  var item = getfilterstreamitem();

  if (!item) {
    return fail("missing stream item");
  }

  if (!item.keys || item.keys.length < 2) {
    return fail("vote must use at least election and choice keys");
  }

  if (!item.data || typeof item.data.json === "undefined") {
    return fail("vote data must be JSON");
  }

  var vote = item.data.json;

  if (!isObject(vote)) {
    return fail("JSON payload must be an object");
  }

  if (!isNonEmptyString(vote.election_id, 64)) {
    return fail("election_id must be a non-empty string up to 64 chars");
  }

  if (!isNonEmptyString(vote.choice, 64)) {
    return fail("choice must be a non-empty string up to 64 chars");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(vote.election_id)) {
    return fail("election_id contains unsupported characters");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(vote.choice)) {
    return fail("choice contains unsupported characters");
  }

  if (typeof vote.schema_version !== "undefined" && vote.schema_version !== 1) {
    return fail("unsupported schema_version");
  }

  var allowedFields = {
    schema_version: true,
    election_id: true,
    choice: true
  };

  for (var field in vote) {
    if (vote.hasOwnProperty(field) && !allowedFields[field]) {
      return fail("unsupported or identity-bearing field: " + field);
    }
  }

  if (!hasKey(item.keys, "election:" + vote.election_id)) {
    return fail("missing election key");
  }

  if (!hasKey(item.keys, "choice:" + vote.choice)) {
    return fail("missing choice key");
  }
}
