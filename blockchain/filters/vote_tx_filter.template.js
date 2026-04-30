// MultiChain Transaction Filter: rejects invalid vote transactions.
// This file is rendered by scripts/votify.py before installation.

var VOTE_ASSET = "__VOTE_ASSET__";
var BALLOT_STREAM = "__BALLOT_STREAM__";
var BURN_ADDRESS = "__BURN_ADDRESS__";
var REQUIRED_AMOUNT = 1;

function fail(message) {
  return "vote transaction rejected: " + message;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function hasKey(keys, expected) {
  if (!keys) {
    return false;
  }

  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === expected) {
      return true;
    }
  }
  return false;
}

function isBallotItem(item) {
  return item && (item.name === BALLOT_STREAM || item.stream === BALLOT_STREAM);
}

function validateVoteItem(item) {
  if (!item.data || typeof item.data.json === "undefined") {
    return fail("vote data must be JSON");
  }

  var vote = item.data.json;

  if (!isObject(vote)) {
    return fail("vote JSON payload must be an object");
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

function filtertransaction() {
  var tx = getfiltertransaction();
  var ballotItems = [];

  if (!tx || !tx.vout) {
    return;
  }

  for (var voutIndex = 0; voutIndex < tx.vout.length; voutIndex++) {
    var output = tx.vout[voutIndex];

    if (!output.items) {
      continue;
    }

    for (var itemIndex = 0; itemIndex < output.items.length; itemIndex++) {
      var item = output.items[itemIndex];
      if (isBallotItem(item)) {
        ballotItems.push(item);
      }
    }
  }

  if (ballotItems.length === 0) {
    return;
  }

  if (ballotItems.length !== 1) {
    return fail("vote transaction must publish exactly one ballot item");
  }

  var voteError = validateVoteItem(ballotItems[0]);
  if (voteError) {
    return voteError;
  }

  var balances = getfilterassetbalances(VOTE_ASSET, true);

  if (!balances) {
    return fail("transaction must consume the voting asset");
  }

  var sent = 0;
  var burned = 0;
  var senderCount = 0;

  for (var address in balances) {
    if (!balances.hasOwnProperty(address)) {
      continue;
    }

    var delta = balances[address];

    if (delta < 0) {
      senderCount++;
      sent += -delta;
    }

    if (delta > 0) {
      if (address !== BURN_ADDRESS) {
        return fail("voting asset must be sent only to the burn address");
      }
      burned += delta;
    }
  }

  if (senderCount !== 1) {
    return fail("exactly one voting address must spend the credential");
  }

  if (sent !== REQUIRED_AMOUNT) {
    return fail("transaction must spend exactly one voting token");
  }

  if (burned !== REQUIRED_AMOUNT) {
    return fail("transaction must burn exactly one voting token");
  }
}
