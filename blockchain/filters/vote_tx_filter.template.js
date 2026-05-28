// MultiChain Transaction Filter: rejects invalid vote transactions.
// This file is rendered by scripts/votify.py before installation.

var VOTE_ASSET = "__VOTE_ASSET__";
var BALLOT_STREAM = "__BALLOT_STREAM__";
var BURN_ADDRESS = "__BURN_ADDRESS__";
var REQUIRED_AMOUNT = 1;

function fail(message) {
  return "Transação de voto rejeitada: " + message;
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
    return fail("os dados do voto devem estar em JSON");
  }

  var vote = item.data.json;

  if (!isObject(vote)) {
    return fail("o conteúdo JSON do voto deve ser um objeto");
  }

  if (!isNonEmptyString(vote.election_id, 64)) {
    return fail("election_id deve ser um texto não vazio com até 64 caracteres");
  }

  if (!isNonEmptyString(vote.choice, 64)) {
    return fail("choice deve ser um texto não vazio com até 64 caracteres");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(vote.election_id)) {
    return fail("election_id contém caracteres não permitidos");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(vote.choice)) {
    return fail("choice contém caracteres não permitidos");
  }

  if (typeof vote.schema_version !== "undefined" && vote.schema_version !== 1) {
    return fail("schema_version não suportado");
  }

  var allowedFields = {
    schema_version: true,
    election_id: true,
    choice: true
  };

  for (var field in vote) {
    if (vote.hasOwnProperty(field) && !allowedFields[field]) {
      return fail("campo não suportado ou com dado de identidade: " + field);
    }
  }

  if (!hasKey(item.keys, "election:" + vote.election_id)) {
    return fail("chave da eleição não informada");
  }

  if (!hasKey(item.keys, "choice:" + vote.choice)) {
    return fail("chave da escolha não informada");
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
    return fail("a transação deve publicar exatamente um item de voto");
  }

  var voteError = validateVoteItem(ballotItems[0]);
  if (voteError) {
    return voteError;
  }

  var balances = getfilterassetbalances(VOTE_ASSET, true);

  if (!balances) {
    return fail("a transação deve consumir o token de votação");
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
        return fail("o token de votação deve ser enviado apenas ao endereço de queima");
      }
      burned += delta;
    }
  }

  if (senderCount !== 1) {
    return fail("exatamente um endereço de votação deve gastar a credencial");
  }

  if (sent !== REQUIRED_AMOUNT) {
    return fail("a transação deve gastar exatamente um token de votação");
  }

  if (burned !== REQUIRED_AMOUNT) {
    return fail("a transação deve queimar exatamente um token de votação");
  }
}
