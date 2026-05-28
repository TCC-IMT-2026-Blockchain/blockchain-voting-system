// MultiChain Stream Filter: validates data published to the "urna" stream.
// It intentionally rejects any identity-bearing fields in vote payloads.

function fail(message) {
  return "Item da urna rejeitado: " + message;
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
    return fail("item da stream não informado");
  }

  if (!item.keys || item.keys.length < 2) {
    return fail("o voto deve usar pelo menos as chaves da eleição e da escolha");
  }

  if (!item.data || typeof item.data.json === "undefined") {
    return fail("os dados do voto devem estar em JSON");
  }

  var vote = item.data.json;

  if (!isObject(vote)) {
    return fail("o conteúdo JSON deve ser um objeto");
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
