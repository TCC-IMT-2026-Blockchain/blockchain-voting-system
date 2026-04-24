# Subir containers
docker-compose down
docker-compose up -d
docker logs votify-slave
docker exec votify-master multichain-cli votifychain grant ENDERECO_DO_SLAVE connect,send,receive

# Criar objetos de identidade e urna (streams)
docker exec votify-master multichain-cli votifychain create stream identidades false
docker exec votify-master multichain-cli votifychain create stream urna true
docker exec votify-master multichain-cli votifychain getinfo

# Inscrição nas streams
docker exec votify-master multichain-cli votifychain subscribe identidades
docker exec votify-master multichain-cli votifychain subscribe urna
docker exec votify-slave multichain-cli votifychain subscribe identidades
docker exec votify-slave multichain-cli votifychain subscribe urna

# Criar identidade
docker exec votify-master multichain-cli votifychain publish identidades "CPF" CHAVE (hex) 